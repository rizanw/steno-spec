import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractSchema, formatSchema } from '../src/index.js';

function sqlProject() {
  const root = mkdtempSync(join(tmpdir(), 'steno-schema-'));
  mkdirSync(join(root, '.steno')); mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true });
  writeFileSync(join(root, 'supabase', 'migrations', '001_types.sql'), `create type kind as enum ('A', 'B'); -- comment`);
  writeFileSync(join(root, 'supabase', 'migrations', '002_tables.sql'), `
-- households
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id),
  kind kind not null
);
create table accounts (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  balance numeric(15, 2) not null default 0,
  normal_balance text generated always as (case when balance > 0 then 'D' else 'C' end) stored,
  unique (household_id, balance),
  constraint fk_x foreign key (household_id) references households(id)
);
create table dropped (id uuid primary key);`);
  writeFileSync(join(root, 'supabase', 'migrations', '003_alter.sql'), `
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS parent_id uuid references accounts(id) on delete set null, add column if not exists nick text;
alter table accounts drop column nick;
alter type kind add value 'C';
drop table if exists dropped;`);
  writeFileSync(join(root, 'supabase', 'seed.sql'), `create table ignored_seed (id int);`);
  return root;
}

describe('schema extraction (sql)', () => {
  it('reads create, alter, references and enums in order and prints one line per table', () => {
    const s = extractSchema(sqlProject());
    expect(s.source).toBe('sql');
    expect(s.tables.map(t => t.name)).toEqual(['households', 'profiles', 'accounts']);
    const text = formatSchema(s);
    expect(text).toContain('households(id): name:text, code:text!, created_at');
    expect(text).toContain('profiles(id→auth.users): →households?, kind:kind');
    expect(text).toContain('accounts(id): →households, balance:num(15,2), normal_balance:text=gen, uniq(household_id,balance), parent_id→accounts?');
    expect(text).not.toContain('nick');
    expect(text).toContain('enum kind: A | B | C');
    expect(text).toContain('households ← profiles, accounts');
    expect(text).not.toContain('accounts ← accounts');   // self-references stay on the table line
  });

  it('says so when there is no schema', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-noschema-')); mkdirSync(join(root, '.steno'));
    expect(formatSchema(extractSchema(root))).toMatch(/no schema found/);
  });
});

describe('schema extraction (prisma)', () => {
  it('reads models, relations and enums', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-prisma-')); mkdirSync(join(root, '.steno')); mkdirSync(join(root, 'prisma'));
    writeFileSync(join(root, 'prisma', 'schema.prisma'), `
enum Role {
  USER
  ADMIN
}
model User {
  id    String @id @default(cuid())
  email String @unique
  role  Role
  posts Post[]
}
model Post {
  id       Int     @id @default(autoincrement())
  title    String
  author   User    @relation(fields: [authorId], references: [id])
  authorId String
  draft    Boolean?
}`);
    const text = formatSchema(extractSchema(root));
    expect(text).toContain('# schema from prisma');
    expect(text).toContain('User(id): email:String!, role:Role');
    expect(text).toContain('Post(id): title:String, authorId→User, draft:bool?');
    expect(text).toContain('enum Role: USER | ADMIN');
    expect(text).toContain('User ← Post');
  });
});

describe('schema extraction (drizzle)', () => {
  const fixtureSql = `
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"org" text NOT NULL,
	CONSTRAINT "members_org_unique" UNIQUE("org")
);
--> statement-breakpoint
CREATE TABLE "orgs" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "name" text NOT NULL);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "temp_uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "members" RENAME COLUMN "temp_uuid" TO "id";--> statement-breakpoint
ALTER TABLE "members" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "org_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "org" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "orgs" DROP CONSTRAINT IF EXISTS "orgs_name_unique";--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT "members_org_unique";
DO $$ BEGIN CREATE TYPE "public"."status" AS ENUM('on', 'off'); EXCEPTION WHEN duplicate_object THEN null; END $$;`;

  it('follows drizzle-kit SQL: quoted idents, schema-qualified references, rename, add primary key, alter column', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-dz-sql-')); mkdirSync(join(root, '.steno')); mkdirSync(join(root, 'drizzle'));
    writeFileSync(join(root, 'drizzle', '0000_init.sql'), fixtureSql);
    const text = formatSchema(extractSchema(root));
    expect(text).toContain('# schema from sql');
    expect(text).toContain('members(id): org:text, →orgs');
    expect(text).toContain('orgs(id): name:text\n');
    expect(text).toContain('enum status: on | off');
    expect(text).toContain('orgs ← members');
  });

  it('prefers the latest drizzle snapshot over SQL', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-dz-snap-')); mkdirSync(join(root, '.steno')); mkdirSync(join(root, 'drizzle', 'meta'), { recursive: true });
    writeFileSync(join(root, 'drizzle', '0000_init.sql'), fixtureSql);
    const snap = (tables: object) => JSON.stringify({ version: '7', dialect: 'postgresql', tables, enums: { 'public.status': { name: 'status', values: ['on', 'off', 'late'] } } });
    writeFileSync(join(root, 'drizzle', 'meta', '0000_snapshot.json'), snap({}));
    writeFileSync(join(root, 'drizzle', 'meta', '0001_snapshot.json'), snap({
      'public.members': { name: 'members', columns: { id: { name: 'id', type: 'uuid', primaryKey: true, notNull: true }, org_id: { name: 'org_id', type: 'uuid', notNull: true }, role: { name: 'role', type: 'text', notNull: false }, qty: { name: 'qty', type: 'numeric(12, 4)', notNull: true } },
        foreignKeys: { fk: { tableFrom: 'members', tableTo: 'orgs', columnsFrom: ['org_id'], columnsTo: ['id'] } }, uniqueConstraints: { u: { columns: ['org_id', 'role'] } } },
      'public.orgs': { name: 'orgs', columns: { id: { name: 'id', type: 'uuid', primaryKey: true, notNull: true }, name: { name: 'name', type: 'text', notNull: true, isUnique: true } } },
    }));
    const s = extractSchema(root);
    expect(s.source).toBe('drizzle-snapshot');
    expect(s.files).toEqual(['drizzle/meta/0001_snapshot.json']);
    const text = formatSchema(s);
    expect(text).toContain('members(id): →orgs, role:text?, qty:num(12,4), uniq(org_id,role)');
    expect(text).toContain('orgs(id): name:text!');
    expect(text).toContain('enum status: on | off | late');
  });

  it('falls back to pgTable() TypeScript when nothing was generated', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-dz-ts-')); mkdirSync(join(root, '.steno')); mkdirSync(join(root, 'src', 'db'), { recursive: true });
    writeFileSync(join(root, 'src', 'db', 'schema.ts'), `
import { pgTable, pgEnum, uuid, text, integer, numeric, timestamp, primaryKey, type AnyPgColumn } from "drizzle-orm/pg-core";
export const statusEnum = pgEnum("status", ["on", "off"]);
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(), // comment, with a "quote"
  status: statusEnum("status").notNull().default("on"),
});
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => members.id),
    price: numeric("price", { precision: 12, scale: 4 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    note: text("note").default("see https://x.y/{a}"), // url with // and a brace, inside a string
  },
  (t) => [primaryKey({ columns: [t.id, t.orgId] }), unique("members_org_note").on(t.orgId, t.note), uniqueIndex("partial").on(t.note).where(isNull(t.note))],
);
export const links = pgTable("links", {
  memberId: uuid("member_id").notNull(),
  memberOrg: uuid("member_org").notNull(),
}, (t) => [foreignKey({ columns: [t.memberId, t.memberOrg], foreignColumns: [members.id, members.orgId], name: "links_fk" }).onDelete("cascade")]);`);
    const s = extractSchema(root);
    expect(s.source).toBe('drizzle-ts');
    const text = formatSchema(s);
    expect(text).toContain('orgs(id): name:text!, status:status');
    expect(text).toContain('members(id,org_id→orgs): parent_id→members?, price:num(12,4), note:text?, uniq(org_id,note), created_at');
    expect(text).toContain('links(-): →members, member_org:uuid');
    expect(text).not.toContain('partial');
    expect(text).toContain('enum status: on | off');
    expect(text).toContain('orgs ← members');
  });
});

describe('schema extraction (sqlalchemy)', () => {
  const write = (root: string, rel: string, text: string) => { mkdirSync(join(root, rel, '..'), { recursive: true }); writeFileSync(join(root, rel), text); };

  it('reads declarative models, mixins from imports, enum classes, table args and Core tables; skips migrations and tests', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-sqla-')); mkdirSync(join(root, '.steno'));
    write(root, 'app/db/mixins.py', `
from datetime import datetime
from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
`);
    write(root, 'app/enums.py', `
import enum

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"

class Tier(enum.Enum):
    FREE = "free"
    PRO = "pro"
`);
    write(root, 'app/db/models.py', `
"""Models. __tablename__ = "not_a_table" inside a docstring."""
from decimal import Decimal
from typing import List, Optional

import sqlalchemy as sa
from sqlalchemy import Column, Enum, ForeignKey, ForeignKeyConstraint, Numeric, String, Table, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .mixins import TimestampMixin
from app.enums import OrderStatus, Tier


class Base(DeclarativeBase):
    pass


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    nickname: Mapped[Optional[str]]
    tier: Mapped[Tier]
    orders: Mapped[List["Order"]] = relationship(back_populates="customer")


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (UniqueConstraint("customer_id", "order_no", name="uq_order_no"),)

    id: Mapped[int] = mapped_column(sa.BigInteger, primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),  # a comment, with (parens)
    )
    number: Mapped[str] = mapped_column("order_no", String(20))
    total: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2))
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", values_callable=lambda e: [x.value for x in e]),
    )
    channel = Column(Enum("web", "store", name="channel"), nullable=False)
    note: Mapped[str | None] = mapped_column(sa.Text)
    customer: Mapped["Customer"] = relationship(back_populates="orders")

    def total_with_tax(self) -> Decimal:
        rate = Column(String)  # not a column: inside a method
        return self.total


class Line(Base):
    __tablename__ = "order_lines"
    order_id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(primary_key=True)
    qty: Mapped[int] = mapped_column(default=1)
    __table_args__ = (ForeignKeyConstraint(["order_id"], ["orders.id"]),)


class Person(Base):
    __tablename__ = "people"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str]


class Employee(Person):
    badge: Mapped[Optional[str]]


order_tags = Table(
    "order_tags",
    Base.metadata,
    Column("order_id", ForeignKey(Order.id), primary_key=True),
    Column("tag", String(30), primary_key=True),
)
`);
    write(root, 'migrations/versions/001_init.py', `class Ghost(Base):\n    __tablename__ = "ghost"\n    id = Column(Integer, primary_key=True)\n`);
    write(root, 'tests/test_models.py', `class Ghost2(Base):\n    __tablename__ = "ghost2"\n    id = Column(Integer, primary_key=True)\n`);
    const s = extractSchema(root);
    expect(s.source).toBe('sqlalchemy');
    expect(s.files).toEqual(['app/db/models.py']);
    expect(s.tables.map(t => t.name)).toEqual(['customers', 'orders', 'order_lines', 'people', 'order_tags']);
    const text = formatSchema(s);
    expect(text).toContain('customers(id): email:text!, nickname:text?, tier:tier, 2×ts');
    expect(text).toContain('orders(id): →customers, order_no:text, total:num(12,2), status:order_status, channel:channel, note:text?, uniq(customer_id,order_no)');
    expect(text).toContain('order_lines(order_id→orders,sku): qty:int');
    expect(text).toContain('people(id): kind:text\n');
    expect(text).toContain('order_tags(order_id→orders,tag)');
    expect(text).toContain('enum tier: FREE | PRO');
    expect(text).toContain('enum order_status: pending | paid');
    expect(text).toContain('enum channel: web | store');
    expect(text).toContain('orders ← order_lines, order_tags');
    expect(text).not.toMatch(/ghost|not_a_table|rate|badge/);
  });

  it('names Flask-SQLAlchemy and SQLModel tables the way those libraries do', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-sqla-flask-')); mkdirSync(join(root, '.steno'));
    write(root, 'blog/models.py', `
from blog import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)

class BlogPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    body = db.Column(db.Text)
`);
    write(root, 'heroes/models.py', `
from typing import Optional
from pydantic import BaseModel
from sqlmodel import Field, Relationship, SQLModel

class Team(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    headquarters: str

class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    age: Optional[int] = None
    team_id: Optional[int] = Field(default=None, foreign_key="team.id")
    team: Optional[Team] = Relationship(back_populates="heroes")

class HeroCreate(SQLModel):
    name: str

class HeroOut(BaseModel):
    name: str = Field(...)
`);
    const text = formatSchema(extractSchema(root));
    expect(text).toContain('# schema from sqlalchemy: 2 files, 4 tables');
    expect(text).toContain('user(id): username:text!');
    expect(text).toContain('blog_post(id): author_id→user, body:text?');
    expect(text).toContain('team(id): name:text, headquarters:text');
    expect(text).toContain('hero(id): name:text, age:int?, →team?');
    expect(text).not.toMatch(/hero_create|herocreate|heroout/i);
  });
});
