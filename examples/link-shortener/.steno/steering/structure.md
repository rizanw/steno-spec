# Project structure

## Top-level layout
```
src/
  store.ts        # Link type, LinkStore interface, MemoryStore and FileStore
  links.ts        # LinkService (the rules), LinkError, normalizeUrl, parseExpiry, isExpired
  server.ts       # createApp: HTTP routing, JSON parsing, error-to-status mapping
  main.ts         # reads environment variables, wires store → service → server, listens
test/
  links.test.ts   # LinkService and normalizeUrl, no HTTP
  server.test.ts  # routes over real HTTP against an in-memory store
  store.test.ts   # FileStore across restarts, on a temp file
.steno/           # steno config, steering and specs
package.json      # scripts and dev dependencies
tsconfig.json     # type-check settings
```

## `src/` — the application
Dependencies point one way: `main.ts` → `server.ts` → `links.ts` → `store.ts`. A file never imports from a file to its left.

| File | Responsibility |
|---|---|
| `store.ts` | Data shape and persistence. `LinkStore` has `get`, `has`, `save`, `delete`, `all`. `MemoryStore` returns copies so callers cannot mutate stored links. `FileStore` extends it and rewrites the whole JSON file on every `save` and `delete`. |
| `links.ts` | Every business rule. `LinkService` has `create`, `get`, `resolve`, `remove`. Validation lives here, including the `CUSTOM_CODE` pattern, the `RESERVED` set and `normalizeUrl`. |
| `server.ts` | Transport only. `route` matches method and path, calls one `LinkService` method, and shapes the response with `present` and `sendJson`. |
| `main.ts` | Composition root. The only file that reads `process.env` or calls `listen`. |

## `test/` — tests
- One test file per source file with rules or routes: `links.test.ts` for `src/links.ts`, `server.test.ts` for `src/server.ts`.
- `links.test.ts` builds a fresh `LinkService` over a `MemoryStore` in each test through its `service()` helper.
- `server.test.ts` starts one app on port 0 in `before` and closes it in `after`; its `post()` helper sends JSON to `/links`.

## Where new code goes
- A new rule or validation → `src/links.ts`, tested in `test/links.test.ts`.
- A new field on a link → the `Link` interface in `src/store.ts`, set in `LinkService.create`.
- A new route or response field → `route` or `present` in `src/server.ts`, tested in `test/server.test.ts`.
- A new error kind → the `LinkErrorKind` union in `src/links.ts` plus its status in `STATUS` in `src/server.ts`. TypeScript fails the type check until both are done.
- A new environment variable → `src/main.ts`, passed into a constructor.
- A new storage backend → a class implementing `LinkStore` in `src/store.ts`.

## Key conventions
- **Rules stay out of the router:** `src/server.ts` never inspects a link's fields to decide an outcome. It calls `LinkService` and lets `LinkError` carry the result.
- **Errors by kind:** throw `new LinkError('<kind>', '<message>')`; never write a status code in `src/links.ts`.
- **Responses go through `sendJson`:** the only exceptions are the bodiless `204` and `302` responses.
- **Links leave through `present`:** every link returned by a route is shaped by `present`, which adds `shortUrl`.
- **Stores hand out copies:** change a link by calling `store.save(link)` with the modified copy, as `LinkService.resolve` does.
- **Service tests over router tests:** test a rule in `test/links.test.ts` first; add a `server.test.ts` case only for the status code and response shape.
- **Time comes from the clock:** `LinkService` takes a `Clock` as its second argument; rules call `this.clock()` and never `new Date()` or `Date.now()`. Tests pass a clock they move by hand.
- **Dependencies by constructor:** `LinkService` receives its `LinkStore`, and `createApp` receives the service and `baseUrl`. Nothing is imported as a global instance.
