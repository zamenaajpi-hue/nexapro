# Nexa Messenger RC Freeze Summary

This release candidate focuses on security hardening, privacy-safe DTOs, unified story privacy, upload validation, and regression coverage.

## Highlights

- Replaced template README with production-oriented documentation.
- Removed real VAPID keys and fallback push keys from source code.
- Hardened `.gitignore` to exclude local databases, uploads, logs, and environment files.
- Introduced strict user DTO separation:
  - `publicUserDto`
  - `privateUserDto`
  - `adminUserDto`
- Locked `publicUserDto` to an exact public-safe shape.
- Removed `socketId` from public user payloads.
- Unified story privacy checks across REST and Socket.IO via shared privacy logic.
- Added validation for `PUBLIC`, `CONTACTS`, `CLOSE_FRIENDS`, and `CUSTOM` stories.
- Extracted upload signature validation into a testable module.
- Added regression tests for fake MIME/signature cases.
- Added Socket.IO payload tests for public mapper safety.
- Fixed `message:edit` to return edited messages through `safeMessage`.
- Added `CHANGELOG.md`.

## Verification

- `npx prisma db push` - passed
- `npm run lint` - passed
- `npm test` - passed, 20/20 tests
- `npm run build` - passed

## Known Warnings

- Vite warns that `localDB.ts` and `e2ee.ts` are both dynamically and statically imported, so they cannot be moved into separate chunks.
- Main frontend JS chunk is around 1.3 MB after minification.

## Deferred to Milestone 2

- PostgreSQL migration branch.
- Production file storage via S3, MinIO, or Cloudflare R2.
- Multipart upload integration tests with DB assertions.
- Gradual strict TypeScript migration.
- Lazy routes and manualChunks for frontend bundle splitting.
- Progressive extraction of large logic from `App.tsx`.
