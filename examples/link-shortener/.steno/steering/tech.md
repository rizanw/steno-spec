# Tech stack

## Runtime and language
- **Node.js ≥ 22.18** — runs the `.ts` files directly through built-in type stripping. There is no build step and no `dist/` folder.
- **TypeScript 5.9** — used only for type checking (`noEmit`). `strict` is on.
- **ES modules** — `"type": "module"` in `package.json`; relative imports carry the `.ts` extension, for example `import { LinkService } from './links.ts'`.

## HTTP and storage
- **`node:http`** — the server is `createServer` with a hand-written router in `src/server.ts`. There is no web framework.
- **`node:crypto` `randomInt`** — picks the characters of generated codes.
- **`node:fs`** — `FileStore` reads and writes one JSON file synchronously. There is no database.
- **Runtime dependencies: none.** `dependencies` in `package.json` is empty and must stay empty.

## Testing
- **`node:test`** — the built-in test runner, with `node:assert/strict` for assertions.
- **Global `fetch`** — server tests start the app on port 0 and call it over real HTTP.
- **Dev dependencies** — only `typescript` and `@types/node` 24.

## Commands
```bash
npm install         # installs typescript and @types/node; not needed to run or test
npm start           # node src/main.ts; serves on PORT (default 3000)
npm test            # node --test "test/**/*.test.ts"; run after every change
npm run typecheck   # tsc --noEmit; run before finishing a task
PORT=4000 BASE_URL=https://sho.rt/ DATA_FILE=data.json npm start   # all three environment variables
```

## Key config files
- `package.json` — scripts, the Node version floor in `engines`, dev dependencies.
- `tsconfig.json` — `module: NodeNext`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`.
- `.gitignore` — ignores `node_modules/`, `data.json` and the skill folders `steno init` installs.

## Conventions
- Type-only imports use `import type`, which `verbatimModuleSyntax` enforces.
- Only erasable TypeScript syntax is allowed: no `enum`, no `namespace`, no constructor parameter properties. Declare the field and assign it in the constructor.
- Domain failures are thrown as `LinkError` with a `kind`; `src/server.ts` maps each kind to a status in its `STATUS` table.
- Environment variables are read only in `src/main.ts`: `PORT`, `BASE_URL`, `DATA_FILE`.
- Timestamps are ISO 8601 strings produced by `new Date().toISOString()`.

## Do not
- Do not add Express, Fastify, Hono or any other runtime dependency.
- Do not add a compile step, `ts-node` or `tsx`; Node runs the sources directly.
- Do not add Jest or Vitest; tests use `node:test`.
- Do not use `any`; parse unknown input and narrow it, as `normalizeUrl` does.
- Do not read `process.env` outside `src/main.ts`.
