// A small test harness for the extension host: `test` registers, `runAll` runs them in order and fails the
// run on the first broken one's report. No test framework: the e2e files only need named steps and polling.
import * as vscode from 'vscode';

/** What the extension's `steno.test.tree` command answers with; mirrors `ProbeItem` in src/probe.ts. */
export interface ProbeItem {
  label: string;
  description?: string;
  contextValue?: string;
  children: ProbeItem[];
}

const tests: { name: string; fn: () => Promise<void> }[] = [];

export function test(name: string, fn: () => Promise<void>): void {
  tests.push({ name, fn });
}

export async function runAll(): Promise<void> {
  const failed: string[] = [];
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok   ${name}`);
    } catch (err) {
      failed.push(name);
      console.error(`  FAIL ${name}\n${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }
  }
  console.log(`${tests.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) throw new Error(`${failed.length} end-to-end test(s) failed: ${failed.join('; ')}`);
}

/**
 * Poll `check` until it returns a value other than `undefined` or `false`, or fail naming `what`.
 * The servers answer in milliseconds; the long limit only absorbs a slow CI machine.
 */
export async function waitFor<T>(what: string, check: () => T | undefined | false | Promise<T | undefined | false>,
  timeoutMs = 20_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last: unknown;
  for (;;) {
    try {
      const value = await check();
      if (value !== undefined && value !== false) return value;
    } catch (err) { last = err; }
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}${last ? `: ${String(last)}` : ''}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/** The extension's tree, as the view would show it right now. */
export async function tree(): Promise<ProbeItem[]> {
  return (await vscode.commands.executeCommand<ProbeItem[]>('steno.test.tree')) ?? [];
}

/** The first item at any depth whose label is `label`. */
export function find(items: ProbeItem[], label: string): ProbeItem | undefined {
  for (const item of items) {
    if (item.label === label) return item;
    const below = find(item.children, label);
    if (below) return below;
  }
  return undefined;
}

/** A path the launcher passed in. */
export function env(name: 'STENO_E2E_ALPHA' | 'STENO_E2E_BETA'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run the e2e tests with \`pnpm test:e2e\``);
  return value;
}

/** Whether two URIs name the same file; Windows paths compare without case. */
export function samePath(a: vscode.Uri, b: vscode.Uri): boolean {
  return process.platform === 'win32' ? a.fsPath.toLowerCase() === b.fsPath.toLowerCase() : a.fsPath === b.fsPath;
}

/** A Spec_Document of the alpha project's `demo` Spec. */
export function demoDoc(file: string): vscode.Uri {
  return vscode.Uri.joinPath(vscode.Uri.file(env('STENO_E2E_ALPHA')), '.steno', 'specs', 'demo', file);
}

/** Replace the first `from` in an open document with `to`, as typing would: the edit is not saved. */
export async function replace(document: vscode.TextDocument, from: string, to: string): Promise<void> {
  const at = document.getText().indexOf(from);
  if (at < 0) throw new Error(`"${from}" is not in ${document.uri.fsPath}`);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(at), document.positionAt(at + from.length)), to);
  if (!(await vscode.workspace.applyEdit(edit))) throw new Error(`the edit to ${document.uri.fsPath} was refused`);
}
