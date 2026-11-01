# Tasks — Link expiry

- [x] 1. Expiry data, clock and input parsing
  - [x] 1.1 Add optional `expiresAt` to `Link`, give `LinkService` a clock, and add `isExpired` with table-driven tests
    - _Requirements: 2.5, 5.4_ _Design: D-is-expired, D-data, D-prop-1_
  - [x] 1.2 Add `parseExpiry` and the `invalid_expiry` error kind with its 400 status, with tests for malformed, zoneless, past and equal-to-now input
    - _Requirements: 1.3, 1.4_ _Design: D-expiry-input, D-errors, D-prop-3_
- [x] 2. Service rules
  - [x] 2.1 Accept `expiresAt` in `LinkService.create`, store it only when given, and test that a rejected expiry leaves the store unchanged
    - _Requirements: 1.1, 1.2_ _Design: D-create, D-prop-3_
  - [x] 2.2 Make `LinkService.resolve` throw the new `expired` kind (status 410) before counting a click, with tests that advance the clock past the expiry
    - _Requirements: 2.1, 2.2, 2.3, 2.4_ _Design: D-resolve, D-errors, D-prop-2_
  - [x] 2.3 Return `LinkView` with `expired` from `LinkService.create` and `LinkService.get`, keeping `expired` out of the store
    - _Requirements: 3.2, 3.3, 3.4, 3.5_ _Design: D-inspect_
  - [x] 2.4 Add tests pinning that an expired link's code stays taken until the link is removed
    - _Requirements: 4.1, 4.2, 4.3, 4.4_ _Design: D-code-reservation_
- [x] 3. Checkpoint — link rules end to end
  Verify: `npm run typecheck` and `npm test` pass; in `test/links.test.ts` a link created with an expiry resolves before the deadline, throws `expired` after it, still shows in `get` with `expired: true`, and its click count is unchanged.
- [x] 4. HTTP surface
  - [x] 4.1 Pass `expiresAt` from the request body to the service and return it through `present`, with HTTP tests for the 201 body, the 400 `invalid_expiry` response and the 410 `expired` response
    - _Requirements: 3.1, 2.4, 1.3_ _Design: D-create, D-errors, D-inspect_
- [x] 5. Persistence
  - [x] 5.1 Add `test/store.test.ts` covering `FileStore`: `expiresAt` survives a reload, a link expires across a restart, and a file written without `expiresAt` loads as never expiring
    - _Requirements: 5.1, 5.2, 5.3_ _Design: D-data, D-is-expired_
- [x] 6. Checkpoint — link expiry end to end
  Verify: `npm run typecheck` and `npm test` pass; with `npm start`, `POST /links` with an `expiresAt` a few seconds ahead returns 201 with `expiresAt` and `expired: false`, `GET /:code` redirects before the deadline and returns 410 after it, `GET /links/:code` then shows `expired: true`, and a past `expiresAt` returns 400.
