# Changelog

## 0.0.0-rc.1 - Release Candidate Security Hardening

- Full release freeze summary: [RELEASE_FREEZE_SUMMARY.md](./RELEASE_FREEZE_SUMMARY.md).
- Locked `publicUserDto` to the public profile shape: `id`, `nickname`, `nexaId`, `avatarColor`, `avatarImage`, `initials`, `bio`, `publicKey`, and `status`.
- Added regression tests to prevent public DTOs and Socket.IO payloads from exposing socket IDs, contact data, auth secrets, balances, roles, or push tokens.
- Hardened message edit broadcasts so edited messages use the same sanitized sender mapper as normal message create/history payloads.
- Confirmed stories use the shared `storyPrivacy.ts` validation and visibility rules across REST and Socket.IO paths.
- Added regression coverage for `CUSTOM` story validation and CONTACTS/CLOSE_FRIENDS privacy checks.
- Expanded upload validation tests for fake MIME declarations, too-short signatures, unknown signatures, and MIME allowlist behavior.
- Documented that multipart upload integration coverage with a DB assertion remains a milestone 2 task.
