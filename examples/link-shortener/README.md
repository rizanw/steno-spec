# link-shortener — steno example

A small link shortener API with one feature already built through a steno spec, and a second one
left for you to build. Use it to see what steno produces before trying it on your own project.

- **Read a finished spec:** [`.steno/specs/link-expiry/`](.steno/specs/link-expiry/) holds the
  requirements, design and tasks that produced the link expiry feature, exactly as steno and an
  agent wrote them.
- **Build a feature yourself:** follow [TUTORIAL.md](TUTORIAL.md) to add click statistics with
  your own agent. It takes about 30 minutes.

## Run it

Needs Node ≥ 22.18. There is no build step and there are no runtime dependencies.

```bash
npm install
```

```bash
npm test
```

```bash
npm start
```

Then, in another terminal:

```bash
curl -s -X POST localhost:3000/links -H 'content-type: application/json' -d '{"url":"https://example.com","code":"demo"}'
```

```bash
curl -i localhost:3000/demo
```

## The API

| Request | Result |
|---|---|
| `POST /links` `{ url, code?, expiresAt? }` | `201` with the link and its `shortUrl` |
| `GET /:code` | `302` to the target, counts a click; `410` once the link has expired |
| `GET /links/:code` | `200` with the link, including `expired`; does not count a click |
| `DELETE /links/:code` | `204` |
| `GET /health` | `200` |

Set `PORT`, `BASE_URL` or `DATA_FILE` (a JSON file to keep links across restarts) to change the defaults.

## What is in `.steno/`

```text
.steno/
  config.yaml                 budgets and agent list
  steering/                   product.md, tech.md, structure.md: project facts every spec starts from
  specs/link-expiry/
    requirements.md           5 requirements, 22 EARS acceptance criteria
    design.md                 design sections, each traced to the criteria it satisfies
    tasks.md                  8 tasks and 2 checkpoints, all done
    spec.yaml                 phase and approvals, owned by the CLI
```

Three commands show how the pieces connect, without opening the files:

```bash
steno status
```

```bash
steno trace --criteria
```

```bash
steno ctx T2.2
```

The last one prints the packet an agent received for task 2.2: only that task's criteria, glossary
terms, design sections and files.
