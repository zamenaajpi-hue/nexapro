# Nexa Messenger

Nexa Messenger is a private messenger with direct chats, groups, channels, stories, calls, and push notifications.

It ships as a Web app, Electron desktop app, and Android app through Capacitor. The backend is an Express/Socket.IO server with Prisma for persistence.

## Features

- Private direct messaging
- Groups and channels
- Stories
- Audio and video calls
- Web, Electron, and Android builds
- Prisma backend
- Web and native push notifications

## Requirements

- Node.js
- npm
- Prisma
- SQLite for local development or PostgreSQL for production

## Setup

```bash
cp .env.example .env
npm ci
npm run db:generate
npm run db:push
npm run dev
```

The development server runs at:

```text
http://localhost:3000
```

## Production

```bash
npm run build
npm run db:deploy
npm start
```

Production notes:

- Set a strong `JWT_SECRET`.
- Generate `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and put it in the server `.env`.
- Set `CORS_ORIGIN` to trusted origins only.
- Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VITE_VAPID_PUBLIC_KEY` before enabling web push.
- Use external object storage such as S3, MinIO, or R2 for production uploads.

## Google Sign-In

Create a Google OAuth 2.0 Client ID with application type `Web application`, then set the same public client ID in:

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

Authorized JavaScript origins must include each origin where Nexa runs:

- `http://localhost:3000` for local development.
- `http://127.0.0.1:47832` for the default desktop app local server.
- Your production HTTPS origin, for example `https://nexa.example.com`.

`npm run build` writes the public client ID into `public/runtime-config.json`, which is copied into `dist` so the packaged desktop server can verify Google sign-ins without shipping server secrets.

## Database Migrations

Use Prisma migrations for schema changes that must be reviewed and deployed safely.

```bash
npm run db:migrate -- --name your_migration_name
npm run db:deploy
```

For local prototyping only, `npm run db:push` can sync the database without creating a migration.

## CI

GitHub Actions runs on pushes to `main`/`master` and on pull requests:

```bash
npm ci
npx prisma validate
npx prisma generate
npm run lint
npm test
npm run build
```

## Tests

```bash
npm test
npm run lint
```

Current regression coverage includes public/private user DTOs, Socket.IO public payload mappers, story privacy rules, and upload file signature validation.

Release changes are tracked in [CHANGELOG.md](./CHANGELOG.md), with the RC freeze summary in [RELEASE_FREEZE_SUMMARY.md](./RELEASE_FREEZE_SUMMARY.md).

## Android

```bash
npm run build
npm run android:sync
npx cap open android
```

## Desktop

```bash
npm run desktop
```

## Environment

Copy `.env.example` to `.env` and replace every `CHANGE_ME` value before running in production.

Secrets such as `JWT_SECRET`, `VAPID_PRIVATE_KEY`, and Firebase credentials must stay on the server and must not be committed.

## Security Notes

- Public user DTOs must not expose email, phone number, date of birth, role, balance, password hashes, push tokens, or socket IDs.
- Uploads are MIME allowlisted and validated by file signature before creating an `UploadedFile` record.
- Story visibility is centralized in `src/server/stories/storyPrivacy.ts` and reused by REST and Socket.IO story flows.
- `.env`, local databases, logs, and uploaded files are ignored by git.

## Roadmap

PostgreSQL migration:

- Add a real PostgreSQL `DATABASE_URL` in a production-like environment.
- Switch Prisma provider from SQLite to PostgreSQL in a dedicated migration branch.
- Generate and review initial migrations with `npm run db:migrate -- --name init`.
- Move production deploys to `npm run db:deploy`.
- Add a PostgreSQL service to CI before replacing SQLite checks.

Strict TypeScript migration:

- Start by typing API DTOs and Socket.IO payloads.
- Replace `any` in server repositories and handlers module by module.
- Extract large `App.tsx` logic into feature hooks before enabling global `strict`.
- Enable `noImplicitAny` first, then full `strict` once the major modules are typed.

Frontend bundle split:

- Split large frontend chunks via lazy routes and/or Vite `manualChunks`.
- Keep the current release candidate stable first; handle chunk tuning in the next milestone unless bundle size becomes a production blocker.

Upload integration:

- Add multipart upload integration tests that assert no `UploadedFile` row is created when signature validation fails.
