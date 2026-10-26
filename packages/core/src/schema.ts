/**
 * Reads SQL migrations (CREATE TABLE, ALTER TABLE ADD/DROP COLUMN, REFERENCES, CREATE TYPE ... AS ENUM),
 * a Prisma schema, a Drizzle schema or SQLAlchemy / SQLModel models, and prints one short line per table with its key columns and
 * foreign keys. The agent pastes that into `database.md` instead of reading every migration itself.
 */
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import picomatch from 'picomatch';
import { probe, type Probe } from './steer.js';

export interface Column { name: string; type: string; nullable: boolean; pk: boolean; unique: boolean; ref?: { table: string; column: string }; generated?: boolean; note?: string }
export interface Table { name: string; columns: Column[]; file: string; /** constraint name → column it marks (unique or fk), for DROP CONSTRAINT */ cons?: Record<string, { col: string; kind: 'unique' | 'fk' }> }
export interface Schema { source: 'sql' | 'prisma' | 'drizzle-snapshot' | 'drizzle-ts' | 'sqlalchemy' | 'none'; files: string[]; tables: Table[]; enums: Record<string, string[]> }

// ---------------------------------------------------------------- SQL

/** Split a parenthesised body on top-level commas. */
function splitTop(body: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Find `(` … matching `)` starting at index `open`. */
function matchParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')' && --depth === 0) return i; }
  return -1;
}

const SHORT_TYPE: [RegExp, string][] = [
  [/^uuid/i, 'uuid'], [/^(text|varchar|character varying|char)\b/i, 'text'], [/^(timestamptz|timestamp with time zone)/i, 'ts'], [/^timestamp/i, 'ts'],
  [/^date\b/i, 'date'], [/^(bool|boolean)/i, 'bool'], [/^(int|integer|int4|serial)\b/i, 'int'], [/^(smallint|int2)/i, 'int2'], [/^(bigint|int8|bigserial)/i, 'int8'],
  [/^(numeric|decimal)\s*\(([^)]*)\)/i, 'num($2)'], [/^(numeric|decimal)/i, 'num'], [/^(double precision|float8|real|float4)/i, 'float'], [/^jsonb?/i, 'json'], [/^bytea/i, 'bytes'],
];
function shortType(t: string): string {
  t = t.replace(/^"?public"?\./i, '').replace(/^"([^"]+)"/, '$1');
  for (const [re, name] of SHORT_TYPE) { const m = re.exec(t); if (m) return name.replace('$2', (m[2] ?? '').replace(/\s/g, '')); }
  return t.split(/[\s(]/)[0].toLowerCase();
}

function parseColumn(def: string): Column | undefined {
  const m = /^"?([a-zA-Z_][\w]*)"?\s+(.+)$/.exec(def);
  if (!m) return undefined;
  const name = m[1], rest = m[2];
  if (/^(constraint|primary key|unique|foreign key|check|exclude)\b/i.test(def)) return undefined;
  const ref = /references\s+("?\w+"?(?:\."?\w+"?)?)\s*\(\s*"?(\w+)"?\s*\)/i.exec(rest);
  return {
    name, type: shortType(rest),
    nullable: !/\bnot null\b/i.test(rest) && !/\bprimary key\b/i.test(rest),
    pk: /\bprimary key\b/i.test(rest), unique: /\bunique\b/i.test(rest),
    ref: ref ? { table: ref[1].replace(/"/g, '').replace(/^public\./, ''), column: ref[2] } : undefined,
    generated: /\bgenerated always as\b/i.test(rest) || undefined,
  };
}

function applySql(sql: string, file: string, tables: Map<string, Table>, enums: Record<string, string[]>): void {
  const text = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const tableName = (raw: string) => raw.replace(/"/g, '').replace(/^public\./i, '');
  const C = '(?:constraint\\s+"?\\w+"?\\s+)?';   // optional `constraint name` prefix, quoted or not
  // enums
  for (const m of text.matchAll(/create\s+type\s+("?\w+"?(?:\."?\w+"?)?)\s+as\s+enum\s*\(([^)]*)\)/gi)) {
    enums[tableName(m[1])] = [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1]);
  }
  for (const m of text.matchAll(/alter\s+type\s+("?\w+"?(?:\."?\w+"?)?)\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']*)'/gi)) {
    const k = tableName(m[1]); (enums[k] ??= []).includes(m[2]) || enums[k].push(m[2]);
  }
  // create table
  const ct = /create\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w.]+"?)\s*\(/gi; let m: RegExpExecArray | null;
  while ((m = ct.exec(text))) {
    const open = m.index + m[0].length - 1, close = matchParen(text, open);
    if (close < 0) continue;
    const name = tableName(m[1]);
    const cols: Column[] = []; const cons: NonNullable<Table['cons']> = {};
    const defs = splitTop(text.slice(open + 1, close));
    for (const d of defs) {
      const pk = new RegExp(`^${C}primary key\\s*\\(([^)]*)\\)`, 'i').exec(d);
      const uq = new RegExp(`^${C}unique\\s*\\(([^)]*)\\)`, 'i').exec(d);
      const fk = new RegExp(`^${C}foreign key\\s*\\(([^)]*)\\)\\s*references\\s+("?\\w+"?(?:\\."?\\w+"?)?)\\s*\\(([^)]*)\\)`, 'i').exec(d);
      const cname = /^constraint\s+"?(\w+)"?/i.exec(d)?.[1];
      if (pk) { for (const c of pk[1].split(',')) { const col = cols.find(x => x.name === c.trim().replace(/"/g, '')); if (col) { col.pk = true; col.nullable = false; } } continue; }
      if (uq) { const names = uq[1].split(',').map(c => c.trim().replace(/"/g, '')); if (names.length === 1) { const col = cols.find(x => x.name === names[0]); if (col) { col.unique = true; if (cname) (cons[cname] = { col: col.name, kind: 'unique' }); } } else { cols.push({ name: `uniq(${names.join(',')})`, type: '', nullable: false, pk: false, unique: true, note: 'constraint' }); if (cname) cons[cname] = { col: `uniq(${names.join(',')})`, kind: 'unique' }; } continue; }
      if (fk) { const first = (l: string) => l.split(',')[0].trim().replace(/"/g, ''); const col = cols.find(x => x.name === first(fk[1])); if (col) { col.ref = { table: tableName(fk[2]), column: first(fk[3]) }; if (cname) cons[cname] = { col: col.name, kind: 'fk' }; } continue; }
      const c = parseColumn(d); if (c) cols.push(c);
    }
    tables.set(name, { name, columns: cols, file, cons });
    ct.lastIndex = close;
  }
  // alter table … add column / drop column / add constraint fk
  for (const a of text.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?("?[\w.]+"?)\s+([\s\S]*?);/gi)) {
    const t = tables.get(tableName(a[1])); if (!t) continue;
    const renameTable = /^rename\s+to\s+("?[\w.]+"?)/i.exec(a[2].trim());
    if (renameTable) { tables.delete(t.name); t.name = tableName(renameTable[1]); tables.set(t.name, t); continue; }
    for (const action of splitTop(a[2])) {
      const rename = /^rename\s+(?:column\s+)?"?(\w+)"?\s+to\s+"?(\w+)"?/i.exec(action);
      if (rename) { const c = t.columns.find(x => x.name === rename[1]); if (c) c.name = rename[2]; continue; }
      const addPk = new RegExp(`^add\\s+${C}primary key\\s*\\(([^)]*)\\)`, 'i').exec(action);
      if (addPk) { for (const n of addPk[1].split(',')) { const c = t.columns.find(x => x.name === n.trim().replace(/"/g, '')); if (c) { c.pk = true; c.nullable = false; } } continue; }
      const alterCol = /^alter\s+(?:column\s+)?"?(\w+)"?\s+(.+)$/i.exec(action);
      if (alterCol) {
        const c = t.columns.find(x => x.name === alterCol[1]); if (!c) continue;
        if (/^set\s+not\s+null/i.test(alterCol[2])) c.nullable = false; else if (/^drop\s+not\s+null/i.test(alterCol[2])) c.nullable = !c.pk;
        else if (/^(set\s+data\s+)?type\s+/i.test(alterCol[2])) c.type = shortType(alterCol[2].replace(/^(set\s+data\s+)?type\s+/i, ''));
        continue;
      }
      const add = /^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?(.+)$/i.exec(action);
      const drop = /^drop\s+(?:column\s+)?(?:if\s+exists\s+)?"?(\w+)"?/i.exec(action);
      const fk = /^add\s+(?:constraint\s+"?(\w+)"?\s+)?foreign key\s*\(([^)]*)\)\s*references\s+("?\w+"?(?:\."?\w+"?)?)\s*\(([^)]*)\)/i.exec(action);
      const first = (l: string) => l.split(',')[0].trim().replace(/"/g, '');
      t.cons ??= {};
      if (fk) { const col = t.columns.find(x => x.name === first(fk[2])); if (col) { col.ref = { table: tableName(fk[3]), column: first(fk[4]) }; if (fk[1]) t.cons[fk[1]] = { col: col.name, kind: 'fk' }; } continue; }
      const addUq = /^add\s+(?:constraint\s+"?(\w+)"?\s+)?unique\s*\(([^)]*)\)/i.exec(action);
      if (addUq) { const names = addUq[2].split(',').map(c => c.trim().replace(/"/g, '')); if (names.length === 1) { const col = t.columns.find(x => x.name === names[0]); if (col) { col.unique = true; if (addUq[1]) t.cons[addUq[1]] = { col: col.name, kind: 'unique' }; } } else { const n = `uniq(${names.join(',')})`; if (!t.columns.some(c => c.name === n)) t.columns.push({ name: n, type: '', nullable: false, pk: false, unique: true, note: 'constraint' }); if (addUq[1]) t.cons[addUq[1]] = { col: n, kind: 'unique' }; } continue; }
      const dropCon = /^drop\s+constraint\s+(?:if\s+exists\s+)?"?(\w+)"?/i.exec(action);
      if (dropCon) {
        let c = t.cons[dropCon[1]];
        if (!c) { const u = new RegExp(`^${t.name}_(\\w+)_unique$`).exec(dropCon[1]); const f = new RegExp(`^${t.name}_(\\w+)_\\w+_fk$`).exec(dropCon[1]); if (u) c = { col: u[1], kind: 'unique' }; else if (f) c = { col: t.columns.find(x => f[1].startsWith(x.name))?.name ?? '', kind: 'fk' }; }
        if (c) { const col = t.columns.find(x => x.name === c!.col); if (col && c.kind === 'unique') { if (col.note === 'constraint') t.columns = t.columns.filter(x => x !== col); else col.unique = false; } else if (col) col.ref = undefined; delete t.cons[dropCon[1]]; }
        continue;
      }
      if (drop) { t.columns = t.columns.filter(c => c.name !== drop[1]); continue; }
      if (add && !/^add\s+constraint/i.test(action)) { const c = parseColumn(add[1]); if (c && !t.columns.some(x => x.name === c.name)) t.columns.push(c); }
    }
  }
  for (const d of text.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?("?[\w.]+"?)/gi)) tables.delete(tableName(d[1]));
}

// ---------------------------------------------------------------- Prisma

function applyPrisma(src: string, file: string, tables: Map<string, Table>, enums: Record<string, string[]>): void {
  for (const e of src.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) enums[e[1]] = e[2].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  const models = [...src.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)].map(m => m[1]);
  for (const m of src.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
    const cols: Column[] = [];
    for (const line of m[2].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('@@'))) {
      const f = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line); if (!f) continue;
      const [, name, type, list, opt, attrs] = f;
      if (models.includes(type)) {
        const rel = /@relation\([^)]*fields:\s*\[(\w+)\][^)]*references:\s*\[(\w+)\]/.exec(attrs);
        if (rel) { const col = cols.find(c => c.name === rel[1]); if (col) col.ref = { table: type, column: rel[2] }; else cols.push({ name: rel[1], type: 'id', nullable: !!opt, pk: false, unique: false, ref: { table: type, column: rel[2] } }); }
        else if (list) cols.push({ name, type: `${type}[]`, nullable: true, pk: false, unique: false, note: 'back-relation' });
        continue;
      }
      const existing = cols.find(c => c.name === name);
      const col: Column = { name, type: shortType(type.toLowerCase()) === type.toLowerCase() ? type : shortType(type.toLowerCase()), nullable: !!opt, pk: /@id\b/.test(attrs), unique: /@unique\b/.test(attrs), ref: existing?.ref };
      if (existing) Object.assign(existing, col); else cols.push(col);
    }
    tables.set(m[1], { name: m[1], columns: cols, file });
  }
}

// ---------------------------------------------------------------- Drizzle (snapshot JSON, then pgTable TS)

interface SnapCol { name: string; type: string; primaryKey?: boolean; notNull?: boolean; generated?: unknown; isUnique?: boolean }
interface SnapTable { name: string; columns: Record<string, SnapCol>; foreignKeys?: Record<string, { tableTo: string; columnsFrom: string[]; columnsTo: string[] }>; compositePrimaryKeys?: Record<string, { columns: string[] }>; uniqueConstraints?: Record<string, { columns: string[] }> }
interface Snapshot { tables: Record<string, SnapTable>; enums?: Record<string, { name: string; values: string[] }> }

function applyDrizzleSnapshot(json: string, file: string, tables: Map<string, Table>, enums: Record<string, string[]>): void {
  const snap = JSON.parse(json) as Snapshot;
  for (const e of Object.values(snap.enums ?? {})) enums[e.name] = e.values;
  for (const t of Object.values(snap.tables)) {
    const cols: Column[] = Object.values(t.columns).map(c => ({ name: c.name, type: shortType(c.type), nullable: !c.notNull && !c.primaryKey, pk: !!c.primaryKey, unique: !!c.isUnique, generated: c.generated ? true : undefined }));
    for (const pk of Object.values(t.compositePrimaryKeys ?? {})) for (const n of pk.columns) { const c = cols.find(x => x.name === n); if (c) { c.pk = true; c.nullable = false; } }
    for (const u of Object.values(t.uniqueConstraints ?? {})) { if (u.columns.length === 1) { const c = cols.find(x => x.name === u.columns[0]); if (c) c.unique = true; } else cols.push({ name: `uniq(${u.columns.join(',')})`, type: '', nullable: false, pk: false, unique: true, note: 'constraint' }); }
    for (const fk of Object.values(t.foreignKeys ?? {})) { const c = cols.find(x => x.name === fk.columnsFrom[0]); if (c) c.ref = { table: fk.tableTo, column: fk.columnsTo[0] }; }
    tables.set(t.name, { name: t.name, columns: cols, file });
  }
}

const TS_TYPE: Record<string, string> = { uuid: 'uuid', text: 'text', varchar: 'text', char: 'text', integer: 'int', int: 'int', smallint: 'int2', bigint: 'int8', serial: 'int', bigserial: 'int8', smallserial: 'int2', boolean: 'bool', timestamp: 'ts', date: 'date', time: 'time', numeric: 'num', decimal: 'num', real: 'float', doublePrecision: 'float', json: 'json', jsonb: 'json', bytea: 'bytes' };

/** Best effort over `pgTable("name", { key: type("col").notNull().references(() => other.id) })`, used only when no snapshot or SQL exists. */
function stripTsComments(src: string): string {
  let out = '', q: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i], nx = src[i + 1];
    if (q) { out += ch; if (ch === q && src[i - 1] !== '\\') q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; out += ch; continue; }
    if (ch === '/' && nx === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (ch === '/' && nx === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    out += ch;
  }
  return out;
}

function applyDrizzleTs(src: string, file: string, tables: Map<string, Table>, enums: Record<string, string[]>): void {
  const text = stripTsComments(src);
  const enumConst = new Map<string, string>();
  for (const e of text.matchAll(/(?:const\s+(\w+)\s*=\s*)?(?:pg|mysql)Enum\(\s*["'](\w+)["']\s*,\s*\[([^\]]*)\]/g)) { enums[e[2]] = [...e[3].matchAll(/["']([^"']*)["']/g)].map(x => x[1]); if (e[1]) enumConst.set(e[1], e[2]); }
  const constToTable = new Map<string, string>();
  for (const m of text.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:pg|sqlite|mysql)Table\(\s*["'](\w+)["']/g)) constToTable.set(m[1], m[2]);
  const re = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pg|sqlite|mysql)Table\(\s*["'](\w+)["']\s*,\s*\{/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const open = text.indexOf('{', m.index + m[0].length - 1), close = matchBracket(text, open, '{', '}');
    if (close < 0) continue;
    const callOpen = text.indexOf('(', m.index + m[0].indexOf('Table('));
    const callClose = matchBracket(text, callOpen, '(', ')');
    const cols: Column[] = [];
    for (const def of splitTopBraces(text.slice(open + 1, close))) {
      const f = /^(\w+)\s*:\s*(\w+)\(\s*(?:["']([\w]+)["'])?/.exec(def); if (!f) continue;
      const [, key, fn, colName] = f;
      const name = colName ?? key;
      const enumType = enumConst.get(fn) ?? (enums[fn] ? fn : undefined);
      const type = enumType ?? TS_TYPE[fn] ?? (/^\w+$/.test(fn) ? fn.toLowerCase() : 'text');
      const precision = /(?:numeric|decimal)\([^)]*precision:\s*(\d+)(?:[^)]*scale:\s*(\d+))?/.exec(def);
      const ref = /\.references\(\s*\([^)]*\)\s*(?::\s*\w+)?\s*=>\s*(\w+)\.(\w+)/.exec(def);
      cols.push({
        name, type: precision ? `num(${precision[1]}${precision[2] ? ',' + precision[2] : ''})` : type,
        nullable: !/\.notNull\(\)/.test(def) && !/\.primaryKey\(\)/.test(def), pk: /\.primaryKey\(\)/.test(def), unique: /\.unique\(\)/.test(def),
        ref: ref ? { table: constToTable.get(ref[1]) ?? ref[1], column: ref[2] } : undefined,
        generated: /\.generatedAlwaysAs\(/.test(def) || undefined,
      });
    }
    // extras: foreignKey({ columns: [t.a], foreignColumns: [o.b] }), primaryKey({ columns: [t.a, t.b] })
    const tail = callClose > close ? text.slice(close, callClose) : '';
    const byKey = (k: string) => cols.find(x => x.name === snake(k) || x.name === k);
    for (const fk of tail.matchAll(/foreignKey\(\s*\{[^}]*columns:\s*\[([^\]]*)\][^}]*foreignColumns:\s*\[([^\]]*)\]/g)) {
      const from = /\w+\.(\w+)/.exec(fk[1]), to = /(\w+)\.(\w+)/.exec(fk[2]);
      const c = from && byKey(from[1]); if (c && to) c.ref = { table: constToTable.get(to[1]) ?? to[1], column: snake(to[2]) };
    }
    for (const pk of tail.matchAll(/primaryKey\(\s*\{\s*columns:\s*\[([^\]]*)\]/g)) for (const k of pk[1].matchAll(/\w+\.(\w+)/g)) { const c = byKey(k[1]); if (c) { c.pk = true; c.nullable = false; } }
    for (const u of tail.matchAll(/\bunique\((?:["'][^"']*["'])?\)\s*\.on\(([^)]*)\)/g)) {   // unique(): a constraint, like the snapshot; uniqueIndex() is an index and is skipped
      const names = [...u[1].matchAll(/\w+\.(\w+)/g)].map(k => byKey(k[1])?.name ?? snake(k[1]));
      if (names.length === 1) { const c = cols.find(x => x.name === names[0]); if (c) c.unique = true; } else cols.push({ name: `uniq(${names.join(',')})`, type: '', nullable: false, pk: false, unique: true, note: 'constraint' });
    }
    tables.set(m[2], { name: m[2], columns: cols, file });
    re.lastIndex = callClose > close ? callClose : close;
  }
}
const snake = (s: string) => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
/** Index of the bracket closing the one at `open`, skipping string and template literals. */
function matchBracket(s: string, open: number, l: string, r: string): number {
  let d = 0, q: string | null = null;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q && s[i - 1] !== '\\') q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
    if (ch === l) d++; else if (ch === r && --d === 0) return i;
  }
  return -1;
}
/** Split an object literal body on top-level commas (ignores commas inside (), [], {} and strings). */
function splitTopBraces(body: string): string[] {
  const out: string[] = []; let depth = 0, cur = '', q: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (q) { cur += ch; if (ch === q && body[i - 1] !== '\\') q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// ---------------------------------------------------------------- SQLAlchemy (declarative models, Flask-SQLAlchemy, SQLModel, Core Table())
// Models are read instead of Alembic migrations: they state the current schema, while migrations mix raw
// `op.execute` SQL, data seeds and batch operations that cannot be replayed reliably.

/** Blank out `#` comments and triple-quoted strings (docstrings), keeping ordinary string literals and newlines. */
function stripPy(src: string): string {
  let out = '', i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const tri = ch.repeat(3);
      if (src.startsWith(tri, i)) { const e = src.indexOf(tri, i + 3); const end = e < 0 ? src.length : e + 3; out += src.slice(i, end).replace(/[^\n]/g, ''); i = end; continue; }
      let j = i + 1; while (j < src.length && src[j] !== ch && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (ch === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    out += ch; i++;
  }
  return out;
}

interface PyStmt { indent: number; text: string }
/** Logical lines: physical lines joined while brackets are open or a line ends in `\`. */
function pyStatements(src: string): PyStmt[] {
  const out: PyStmt[] = []; let cur = '', depth = 0, indent = 0;
  for (const line of src.split('\n')) {
    if (!cur && !line.trim()) continue;
    if (!cur) indent = line.length - line.trimStart().length;
    let q: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") q = ch; else if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    }
    const cont = line.trimEnd().endsWith('\\');
    cur += (cur ? ' ' : '') + line.trim().replace(/\\$/, '');
    if (depth <= 0 && !cont) { out.push({ indent, text: cur }); cur = ''; depth = 0; }
  }
  if (cur.trim()) out.push({ indent, text: cur });
  return out;
}

interface PyClass { name: string; bases: string[]; rawBases: string[]; kw: string; file: string; body: string[] }
/** Every `class` statement with its direct-level body statements (method bodies are skipped). */
function pyClasses(stmts: PyStmt[], file: string): PyClass[] {
  const out: PyClass[] = [];
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i].text, m = /^class\s+(\w+)\s*/.exec(s); if (!m) continue;
    let head = '', rest = s.slice(m[0].length);
    if (rest.startsWith('(')) { const close = matchBracket(rest, 0, '(', ')'); if (close < 0) continue; head = rest.slice(1, close); rest = rest.slice(close + 1); }
    const after = /^\s*:\s*(.*)$/.exec(rest); if (!after) continue;
    const body: string[] = after[1] ? [after[1]] : []; let level = -1;
    for (let j = i + 1; j < stmts.length && stmts[j].indent > stmts[i].indent; j++) { if (level < 0) level = stmts[j].indent; if (stmts[j].indent === level) body.push(stmts[j].text); }
    const args = splitTopBraces(head), pos = args.filter(a => !/^\w+\s*=/.test(a)).map(a => a.replace(/\[.*$/, '').trim());
    out.push({ name: m[1], rawBases: pos, bases: pos.map(b => b.split('.').pop()!), kw: args.filter(a => /^\w+\s*=/.test(a)).join(','), file, body });
  }
  return out;
}

interface PyCol { key: string; name: string; kind: 'mapped' | 'column' | 'field' | 'ann'; type?: string; nullable?: boolean; pk: boolean; unique: boolean; fk?: string; generated?: boolean; ann?: { inner: string; optional: boolean }; enumRef?: { cls: string; byValue: boolean; name?: string }; enumLits?: { name?: string; values: string[] }; note?: string }

const SA_TYPE: Record<string, string> = {
  Integer: 'int', INTEGER: 'int', INT: 'int', SmallInteger: 'int2', SMALLINT: 'int2', BigInteger: 'int8', BIGINT: 'int8',
  String: 'text', Text: 'text', TEXT: 'text', Unicode: 'text', UnicodeText: 'text', VARCHAR: 'text', NVARCHAR: 'text', CHAR: 'text', CITEXT: 'text',
  Boolean: 'bool', BOOLEAN: 'bool', DateTime: 'ts', DATETIME: 'ts', TIMESTAMP: 'ts', Date: 'date', DATE: 'date', Time: 'time', TIME: 'time', Interval: 'interval',
  Float: 'float', FLOAT: 'float', REAL: 'float', Double: 'float', DOUBLE: 'float', DOUBLE_PRECISION: 'float', Numeric: 'num', NUMERIC: 'num', DECIMAL: 'num',
  JSON: 'json', JSONB: 'json', UUID: 'uuid', Uuid: 'uuid', LargeBinary: 'bytes', BYTEA: 'bytes', BLOB: 'bytes', INET: 'inet',
};
const PY_TYPE: Record<string, string> = { int: 'int', str: 'text', bool: 'bool', float: 'float', Decimal: 'num', datetime: 'ts', date: 'date', time: 'time', timedelta: 'interval', UUID: 'uuid', bytes: 'bytes', dict: 'json', Dict: 'json', list: 'json', List: 'json', Any: 'json' };
const unquote = (s: string) => /^[rbuf]*["']([^"']*)["']$/i.exec(s.trim())?.[1];

/** A SQLAlchemy type expression (`sa.Numeric(10, 3)`, `Enum(Status, name="status")`, `ARRAY(String)`) onto the column. */
function pyType(expr: string, col: PyCol): void {
  const m = /^(?:\w+\.)*(\w+)\s*(?:\(([\s\S]*)\))?$/.exec(expr.trim()); if (!m) return;
  const [, fn, inner = ''] = m, args = splitTopBraces(inner);
  const kw = (k: string) => args.map(a => new RegExp(`^${k}\\s*=\\s*(.+)$`).exec(a)?.[1]).find(Boolean);
  if (fn === 'Enum' || fn === 'ENUM') {
    const name = unquote(kw('name') ?? '');
    const cls = args.find(a => /^[A-Za-z_][\w.]*$/.test(a))?.split('.').pop();
    if (cls) col.enumRef = { cls, byValue: !!kw('values_callable'), name };
    else col.enumLits = { name, values: args.map(unquote).filter((x): x is string => x !== undefined) };
    return;
  }
  if (fn === 'ARRAY') { const sub: PyCol = { key: '', name: '', kind: 'column', pk: false, unique: false }; pyType(args[0] ?? '', sub); col.type = `${sub.type ?? 'text'}[]`; return; }
  if (SA_TYPE[fn] === 'num') {
    const pos = args.filter(a => /^\d+$/.test(a)), p = kw('precision') ?? pos[0], s = kw('scale') ?? pos[1];
    col.type = p ? `num(${p}${s ? ',' + s : ''})` : 'num'; return;
  }
  col.type = SA_TYPE[fn] ?? fn.toLowerCase();
}

/** Arguments of `mapped_column(...)`, `Column(...)` or SQLModel `Field(...)`. */
function pyColArgs(args: string, col: PyCol): void {
  for (const a of splitTopBraces(args)) {
    if (a.startsWith('*')) continue;
    const kw = /^(\w+)\s*=\s*([\s\S]+)$/.exec(a);
    if (kw) {
      const [, k, v] = kw;
      if (k === 'primary_key') col.pk = v === 'True';
      else if (k === 'nullable') col.nullable = v === 'True';
      else if (k === 'unique') col.unique = v === 'True';
      else if (k === 'foreign_key') col.fk = v;
      else if (k === 'name') col.name = unquote(v) ?? col.name;
      else if (k === 'type_' || k === 'sa_type') pyType(v, col);
      else if (k === 'sa_column') { const c = /^(?:\w+\.)*Column\s*\(([\s\S]*)\)$/.exec(v); if (c) pyColArgs(c[1], col); }
      continue;
    }
    const str = unquote(a); if (str !== undefined) { col.name = str; continue; }
    const fk = /^(?:\w+\.)*ForeignKey\s*\(\s*([^,)]+)/.exec(a); if (fk) { col.fk = fk[1].trim(); continue; }
    if (/^(?:\w+\.)*Computed\s*\(/.test(a)) { col.generated = true; continue; }
    if (/^(?:\w+\.)*(Identity|Sequence|CheckConstraint|Index|FetchedValue)\s*\(/.test(a)) continue;
    if (!col.type && !col.enumRef && !col.enumLits) pyType(a, col);
  }
}

/** `Mapped[Optional[int]]`, `int | None`, `Union[str, None]` → inner type and nullability. */
function pyAnn(ann: string): { inner: string; optional: boolean } {
  const unq = (x: string) => x.trim().replace(/^["']|["']$/g, '');
  let s = unq(ann), optional = false;
  const mapped = /^(?:\w+\.)*Mapped\[([\s\S]*)\]$/.exec(s); if (mapped) s = unq(mapped[1]);
  const o = /^(?:\w+\.)*Optional\[([\s\S]*)\]$/.exec(s); if (o) { s = o[1]; optional = true; }
  const u = /^(?:\w+\.)*Union\[([\s\S]*)\]$/.exec(s); if (u) { const all = splitTopBraces(u[1]), parts = all.filter(x => x !== 'None'); optional ||= parts.length < all.length; s = parts[0] ?? s; }
  if (/\|\s*None$|^None\s*\|/.test(s)) { s = s.replace(/\s*\|\s*None$|^None\s*\|\s*/, ''); optional = true; }
  return { inner: unq(s), optional };
}
const pyAnnType = (inner: string) => PY_TYPE[inner.replace(/\[.*$/, '').split('.').pop()!];

interface PyModel { table?: string; abstract: boolean; cols: PyCol[]; tableArgs: string[] }
const COL_CALL = /^(\w+)\s*(?::\s*(.+?))?\s*=\s*(?:\w+\.)*(mapped_column|Column|Field)\s*\(/;

function pyModel(c: PyClass): PyModel {
  const model: PyModel = { abstract: false, cols: [], tableArgs: [] };
  const sqlmodel = /\btable\s*=\s*True/.test(c.kw);
  for (const s of c.body) {
    let m: RegExpExecArray | null;
    if ((m = /^__tablename__\s*(?::[^=]+)?=\s*(["'][^"']+["'])/.exec(s))) model.table = unquote(m[1]);
    else if (/^__abstract__\s*=\s*True/.test(s)) model.abstract = true;
    else if ((m = /^__table_args__\s*(?::[^=]+)?=\s*([\s\S]+)$/.exec(s))) model.tableArgs.push(m[1]);
    else if ((m = COL_CALL.exec(s))) {
      const open = m[0].length - 1, close = matchBracket(s, open, '(', ')');
      const col: PyCol = { key: m[1], name: m[1], kind: m[3] === 'mapped_column' ? 'mapped' : m[3] === 'Column' ? 'column' : 'field', pk: false, unique: false };
      if (m[3] === 'Field' && !sqlmodel) continue;   // pydantic Field on a non-table class
      if (m[2]) col.ann = pyAnn(m[2]);
      pyColArgs(s.slice(open + 1, close < 0 ? s.length : close), col);
      model.cols.push(col);
    } else if ((m = /^(\w+)\s*:\s*(.+?)(?:\s*=\s*(.+))?$/.exec(s)) && !m[1].startsWith('__') && !/ClassVar/.test(m[2])) {
      // `x: Mapped[int]` (declarative) or `x: int = 0` (SQLModel); relationships and other calls are not columns
      const isMapped = /^(?:\w+\.)*Mapped\[/.test(m[2]);
      if ((isMapped && !m[3]) || (sqlmodel && !isMapped && !(m[3] && /^(?:\w+\.)*\w+\s*\(/.test(m[3]))))
        model.cols.push({ key: m[1], name: m[1], kind: 'ann', ann: pyAnn(m[2]), pk: false, unique: false });
    }
  }
  return model;
}

/** UniqueConstraint / PrimaryKeyConstraint / ForeignKeyConstraint calls in `__table_args__` or `Table(...)`. */
function pyConstraints(text: string, cols: PyCol[]): void {
  const lits = (s: string) => [...s.matchAll(/["']([\w.]+)["']/g)].map(x => x[1]);
  const calls = (fn: string) => [...text.matchAll(new RegExp(`\\b${fn}\\s*\\(`, 'g'))].map(u => { const open = u.index! + u[0].length - 1; return splitTopBraces(text.slice(open + 1, matchBracket(text, open, '(', ')'))).filter(a => !/^\w+\s*=/.test(a)); });
  for (const args of calls('UniqueConstraint')) {
    const names = args.flatMap(lits);
    if (names.length === 1) { const c = cols.find(x => x.name === names[0]); if (c) c.unique = true; }
    else if (names.length > 1) cols.push({ key: '', name: `uniq(${names.join(',')})`, kind: 'column', pk: false, unique: true, note: 'constraint' });
  }
  for (const args of calls('PrimaryKeyConstraint')) for (const n of args.flatMap(lits)) { const c = cols.find(x => x.name === n); if (c) c.pk = true; }
  for (const args of calls('ForeignKeyConstraint')) {
    const from = lits(args[0] ?? '')[0], to = lits(args[1] ?? '')[0];
    const c = cols.find(x => x.name === from); if (c && to) c.fk = `"${to}"`;
  }
}

/** Files a model file imports with `from x.y import Z` that exist in the repo (one level, for mixins and enums). */
function pyImports(stmts: PyStmt[], file: string, pyFiles: string[]): string[] {
  const out = new Set<string>();
  for (const s of stmts) {
    if (s.indent) continue;
    const m = /^from\s+(\.*)([\w.]*)\s+import\s+(.+)$/.exec(s.text); if (!m) continue;
    const names = m[3].replace(/[()]/g, '').split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(n => /^\w+$/.test(n));
    const mod = m[2].replace(/\./g, '/');
    const wanted = (base: string) => [`${base}.py`, `${base}/__init__.py`, ...names.map(n => `${base}/${n}.py`)].map(x => x.replace(/^\/+/, ''));
    if (m[1]) { let d = posix.dirname(file); for (let k = 1; k < m[1].length; k++) d = posix.dirname(d); for (const w of wanted(posix.join(d, mod))) if (pyFiles.includes(w)) out.add(w); }
    else if (mod) { const ws = wanted(mod); for (const f of pyFiles) if (ws.some(w => f === w || f.endsWith('/' + w))) out.add(f); }
  }
  out.delete(file);
  return [...out];
}

function applySqlAlchemy(root: string, modelFiles: string[], pyFiles: string[], tables: Map<string, Table>, enums: Record<string, string[]>): void {
  const read = (f: string) => { try { return stripPy(readFileSync(join(root, f), 'utf8')); } catch { return ''; } };
  const classes = new Map<string, PyClass>(), models = new Map<PyClass, PyModel>(), own: PyClass[] = [];
  const core: { varName: string; table: string; file: string; cols: PyCol[]; rest: string }[] = [];
  const parsed = new Set<string>();
  const load = (f: string, isModel: boolean) => {
    if (parsed.has(f)) return []; parsed.add(f);
    const stmts = pyStatements(read(f));
    for (const c of pyClasses(stmts, f)) { classes.set(c.name, c); models.set(c, pyModel(c)); if (isModel) own.push(c); }
    if (isModel) for (const s of stmts) {
      const m = /^(\w+)\s*(?::[^=]+)?=\s*(?:\w+\.)*Table\s*\(\s*["'](\w+)["']\s*,/.exec(s.text); if (!m) continue;
      const open = s.text.indexOf('(', m[0].indexOf('Table')), close = matchBracket(s.text, open, '(', ')');
      const parts = splitTopBraces(s.text.slice(open + 1, close < 0 ? s.text.length : close)).slice(2), cols: PyCol[] = [];
      for (const a of parts) { const c = /^(?:\w+\.)*Column\s*\(([\s\S]*)\)$/.exec(a); if (!c) continue; const col: PyCol = { key: '', name: '', kind: 'column', pk: false, unique: false }; pyColArgs(c[1], col); if (col.name) cols.push(col); }
      core.push({ varName: m[1], table: m[2], file: f, cols, rest: parts.filter(a => !/^(?:\w+\.)*Column\s*\(/.test(a)).join(',') });
    }
    return stmts;
  };
  const loaded = modelFiles.map(f => [f, load(f, true)] as const);   // all model files first, so an import never claims one
  for (const [f, stmts] of loaded) for (const imp of pyImports(stmts, f, pyFiles)) load(imp, false);

  // table name of a class, or undefined for mixins, abstract bases and single-table-inheritance children
  const memo = new Map<PyClass, string | undefined>();
  const tableOf = (c: PyClass, seen = new Set<PyClass>()): string | undefined => {
    if (memo.has(c)) return memo.get(c);
    if (seen.has(c)) return undefined; seen.add(c);
    const mdl = models.get(c)!;
    let t = mdl.table;
    if (!t && !mdl.abstract) {
      const parentTabled = c.bases.some(b => { const p = classes.get(b); return p && p !== c && tableOf(p, seen); });
      if (/\btable\s*=\s*True/.test(c.kw)) t = c.name.toLowerCase();                                   // SQLModel
      else if (!parentTabled && c.rawBases.some(b => /^\w+\.Model$/.test(b))) t = snake(c.name).replace(/^_/, '');   // Flask-SQLAlchemy
    }
    memo.set(c, t); return t;
  };
  const inherited = (c: PyClass, seen: Set<PyClass>): PyCol[] => c.bases.flatMap(b => {
    const p = classes.get(b); if (!p || seen.has(p) || tableOf(p)) return []; seen.add(p);
    return [...models.get(p)!.cols, ...inherited(p, seen)];
  });
  const enumMembers = (cls: string, byValue: boolean): string[] | undefined => {
    const c = classes.get(cls); if (!c || !c.bases.some(b => /Enum$/.test(b))) return undefined;
    return c.body.map(s => /^([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(.+)$/.exec(s)).filter((m): m is RegExpExecArray => !!m && !/^_.*_$/.test(m[1]))
      .map(m => byValue ? (unquote(m[2]) ?? m[2]) : m[1]);
  };
  const resolveFk = (raw: string): Column['ref'] => {
    const lit = unquote(raw);
    if (lit !== undefined) { const parts = lit.split('.'); const column = parts.pop()!; return parts.length ? { table: parts.join('.').replace(/^public\./, ''), column } : undefined; }
    const coreRef = /(\w+)\.c\.(\w+)$/.exec(raw); if (coreRef) return { table: core.find(t => t.varName === coreRef[1])?.table ?? coreRef[1], column: coreRef[2] };
    const attr = /(\w+)\.(\w+)$/.exec(raw); if (!attr) return undefined;
    const target = classes.get(attr[1]), tm = target && tableOf(target);
    const col = target && [...models.get(target)!.cols, ...inherited(target, new Set())].find(x => x.key === attr[2]);
    return { table: tm ?? attr[1], column: col?.name ?? attr[2] };
  };
  const finish = (table: string, raw: PyCol[]): Column[] => raw.map(r => {
    let type = r.type;
    const annEnum = !type && !r.enumRef && !r.enumLits && r.ann && !pyAnnType(r.ann.inner) && enumMembers(r.ann.inner, false) ? r.ann.inner : undefined;
    const ref = r.enumRef ?? (annEnum ? { cls: annEnum, byValue: false, name: undefined } : undefined);
    if (ref) { type = ref.name ?? ref.cls.toLowerCase(); const v = enumMembers(ref.cls, ref.byValue); if (v) enums[type] = v; }
    else if (r.enumLits) { type = r.enumLits.name ?? `${table}_${r.name}`; enums[type] = r.enumLits.values; }
    type ??= r.ann ? pyAnnType(r.ann.inner) ?? r.ann.inner.toLowerCase() : '';
    const nullable = r.pk ? false : r.nullable ?? (r.kind === 'column' ? true : r.ann ? r.ann.optional : true);
    return { name: r.name, type, nullable, pk: r.pk, unique: r.unique, ref: r.fk ? resolveFk(r.fk) : undefined, generated: r.generated, note: r.note };
  });

  for (const c of own) {
    const t = tableOf(c); if (!t) continue;
    const mdl = models.get(c)!, seen = new Set([c]);
    const cols = [...mdl.cols];
    for (const x of inherited(c, seen)) if (!cols.some(y => y.key === x.key)) cols.push({ ...x });
    const keep = cols.filter(x => x.kind !== 'ann' || pyAnnType(x.ann!.inner) || enumMembers(x.ann!.inner, false));   // drop annotations that name a model
    for (const a of mdl.tableArgs) pyConstraints(a, keep);
    tables.set(t, { name: t, columns: finish(t, keep), file: c.file });
  }
  for (const t of core) { pyConstraints(t.rest, t.cols); tables.set(t.table, { name: t.table, columns: finish(t.table, t.cols), file: t.file }); }
}

// ---------------------------------------------------------------- entry points

export function extractSchema(root: string, p: Probe = probe(root)): Schema {
  const tables = new Map<string, Table>(); const enums: Record<string, string[]> = {};
  const isPrisma = picomatch('**/schema.prisma');
  const prisma = p.files.filter(f => isPrisma(f));
  if (prisma.length) {
    for (const f of prisma) applyPrisma(readFileSync(join(root, f), 'utf8'), f, tables, enums);
    return { source: 'prisma', files: prisma, tables: [...tables.values()], enums };
  }
  const isSnap = picomatch('**/meta/*_snapshot.json');
  const snaps = p.files.filter(f => isSnap(f)).sort();
  if (snaps.length) {   // drizzle-kit: the last snapshot is the whole current schema
    const latest = snaps[snaps.length - 1];
    applyDrizzleSnapshot(readFileSync(join(root, latest), 'utf8'), latest, tables, enums);
    return { source: 'drizzle-snapshot', files: [latest], tables: [...tables.values()], enums };
  }
  const isSql = picomatch(['**/migrations/**/*.sql', '**/migrate/**/*.sql', '**/schema.sql', '**/db/**/*.sql', '**/database/**/*.sql', '**/supabase/**/*.sql', '**/drizzle/**/*.sql']);
  const sql = p.files.filter(f => isSql(f) && !/seed|rollback/i.test(f)).sort();
  if (sql.length) {
    for (const f of sql) applySql(readFileSync(join(root, f), 'utf8'), f, tables, enums);
    return { source: 'sql', files: sql, tables: [...tables.values()], enums };
  }
  const isTs = picomatch(['**/schema.ts', '**/schema/*.ts', '**/db/**/*.ts', '**/drizzle/**/*.ts']);
  const ts = p.files.filter(f => isTs(f) && !/\.(test|spec)\./.test(f)).filter(f => /\b(pg|sqlite|mysql)Table\(/.test(readFileSync(join(root, f), 'utf8'))).sort();
  if (ts.length) {
    for (const f of ts) applyDrizzleTs(readFileSync(join(root, f), 'utf8'), f, tables, enums);
    return { source: 'drizzle-ts', files: ts, tables: [...tables.values()], enums };
  }
  const pyFiles = p.files.filter(f => f.endsWith('.py'));
  const isPyModel = (f: string) => {
    if (/(^|\/)(migrations|alembic|versions|tests?)\//.test(f) || /(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$/.test(f)) return false;
    let t = ''; try { t = readFileSync(join(root, f), 'utf8'); } catch { return false; }
    return t.length < 512_000 && (/__tablename__|\btable\s*=\s*True|\(\s*\w+\.Model\s*[,)]/.test(t) || /\bTable\s*\(\s*["']\w+["']/.test(t)) && /\b(mapped_column|Column|Field)\s*\(|:\s*Mapped\[/.test(t);
  };
  const py = pyFiles.filter(isPyModel).sort();
  if (py.length) {
    applySqlAlchemy(root, py, pyFiles, tables, enums);
    if (tables.size) return { source: 'sqlalchemy', files: py, tables: [...tables.values()], enums };
  }
  return { source: 'none', files: [], tables: [], enums };
}

/**
 * One line per table: `name(pk): col:type, col:type?, col→table, …`. `?` = nullable, `!` = unique,
 * `→` = foreign key (column name is kept when it is not `<table>_id`), `=gen` = generated.
 * `created_at`/`updated_at` timestamps are folded into `…ts` to save tokens. A primary key that is
 * also a foreign key prints as `table(id→parent)`.
 */
export function formatSchema(s: Schema, opts: { full?: boolean } = {}): string {
  if (s.source === 'none') return 'no schema found (looked for schema.prisma, drizzle meta/*_snapshot.json, *.sql under migrations/, db/, database/, supabase/, drizzle/, Drizzle pgTable() files, and SQLAlchemy / SQLModel models)';
  const lines: string[] = [`# schema from ${s.source}: ${s.files.length} file${s.files.length === 1 ? '' : 's'}, ${s.tables.length} tables`];
  const singular = (t: string) => t.replace(/ies$/, 'y').replace(/s$/, '');
  for (const t of s.tables) {
    const pk = t.columns.filter(c => c.pk).map(c => c.ref ? `${c.name}→${c.ref.table}` : c.name).join(',');
    const parts: string[] = []; let ts = 0;
    for (const c of t.columns) {
      if (c.pk) continue;   // shown in the parentheses
      if (!opts.full && /^(created|updated|deleted)_at$/.test(c.name) && c.type === 'ts') { ts++; continue; }
      if (c.note === 'back-relation') { if (opts.full) parts.push(`${c.name}:${c.type}`); continue; }
      if (c.note === 'constraint') { parts.push(c.name); continue; }
      if (c.ref) {
        const implied = c.name === `${singular(c.ref.table)}_id` || c.name === `${c.ref.table}_id` || c.name === `${c.ref.table.charAt(0).toLowerCase() + c.ref.table.slice(1)}Id`;
        parts.push(`${implied ? '' : c.name}→${c.ref.table}${c.ref.column !== 'id' ? '.' + c.ref.column : ''}${c.nullable ? '?' : ''}`);
        continue;
      }
      parts.push(`${c.name}:${c.type}${c.generated ? '=gen' : ''}${c.unique ? '!' : ''}${c.nullable && !c.generated ? '?' : ''}`);
    }
    if (ts && !opts.full) parts.push(ts === 1 ? 'created_at' : `${ts}×ts`);
    lines.push(`${t.name}(${pk || '-'}): ${parts.join(', ')}`);
  }
  const en = Object.entries(s.enums);
  if (en.length) lines.push('', ...en.map(([k, v]) => `enum ${k}: ${v.join(' | ')}`));
  // relations summary: parent ← children
  const children = new Map<string, Set<string>>();
  for (const t of s.tables) for (const c of t.columns) if (c.ref && c.ref.table !== t.name) { if (!children.has(c.ref.table)) children.set(c.ref.table, new Set()); children.get(c.ref.table)!.add(t.name); }
  if (children.size) lines.push('', ...[...children.entries()].map(([p, kids]) => `${p} ← ${[...kids].join(', ')}`));
  return lines.join('\n');
}
