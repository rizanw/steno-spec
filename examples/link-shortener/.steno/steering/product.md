# Product — link-shortener

**link-shortener** is a small HTTP API that turns a long URL into a short code and redirects visitors of that code to the original URL. It runs as one Node process on `http://localhost:3000/` by default and is the hands-on example project for steno.

## Core problem
Long URLs are awkward to share and give the sharer no idea whether anyone followed them. This service gives each URL a short code, redirects anyone who visits the code, and counts how many times that happened.

## Key features
- **Create a link** — `POST /links` with JSON `{ "url": "...", "code": "...", "expiresAt": "..." }`; `code` and `expiresAt` are optional. Responds `201` with `code`, `url`, `clicks`, `createdAt`, `expired`, `shortUrl`, and `expiresAt` when one was set.
- **Generated codes** — when `code` is omitted the service generates 6 random characters from `0-9a-zA-Z` and retries until the code is unused.
- **Custom codes** — a caller-chosen `code` must be 3–32 characters of letters, digits, `-` or `_`. The codes `links` and `health` are reserved because they are route names.
- **Redirect** — `GET /:code` responds `302` with the target in the `Location` header and adds 1 to the link's `clicks`.
- **Link expiry** — `expiresAt` must be a future ISO 8601 time with a time zone. From that time `GET /:code` responds `410` and counts no click, while the link stays inspectable with `expired: true` and keeps its code until deleted.
- **Inspect a link** — `GET /links/:code` returns the link as JSON and does not count a click.
- **Delete a link** — `DELETE /links/:code` responds `204`; the code can be reused afterwards.
- **Health check** — `GET /health` responds `200` with `{ "ok": true }`.
- **Persistence** — links live in memory unless the `DATA_FILE` environment variable names a JSON file, in which case every change is written to that file and loaded on start.

## Audience
- Developers learning steno, who read the code and add features to it through specs.
- API clients only: there is no web page, no login and no translated text. All messages are English.

## Domain model and rules
- A **link** has a `code` (its identity), a target `url`, a `clicks` count and a `createdAt` ISO 8601 timestamp, plus an optional `expiresAt` stored in UTC.
- Whether a link is expired is computed from `expiresAt` and the current time on every request; it is never stored, and a link without `expiresAt` never expires.
- A code maps to at most one link at a time. Creating a link with a code already in use fails with `code_taken`.
- Only absolute `http:` and `https:` URLs are accepted. The stored `url` is the normalized form from the WHATWG `URL` parser, so `https://example.com` is stored as `https://example.com/`.
- Only following a link (`GET /:code`) changes `clicks`. Inspecting never does.
- Errors are JSON `{ "error": "<kind>", "message": "<text>" }`. The kinds are `invalid_url` (400), `invalid_code` (400), `invalid_expiry` (400), `bad_request` (400), `code_taken` (409), `not_found` (404), `expired` (410) and `internal` (500).
- A request body larger than 10,000 bytes is rejected with `bad_request`.

## Out of scope
- User accounts, API keys and per-user ownership of links.
- Editing a link's target after creation.
- A web interface, QR codes and link previews.
- Automatic removal of expired links, and changing a link's expiry after creation.
- Rate limiting and abuse or malware checks on target URLs.
- Running more than one process against the same `DATA_FILE`.
