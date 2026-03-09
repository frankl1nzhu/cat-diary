# cat-diary

A mobile-first cat family diary app with real-time sync support:
- Dashboard: feeding, poop logs, mood, countdowns, and inventory reminders
- Logs: diary timeline, photos, and weight records
- Stats: weight trends, health records, and inventory management
- Settings: cat profile, avatar upload, and PWA installation

## Tech Stack

- React 19 + TypeScript + Vite
- Supabase (Auth / Postgres / Storage / Realtime)
- Zustand (client-side state)
- Recharts (charts)
- PWA (vite-plugin-pwa)

## Local Development

1. Install dependencies

```bash
npm install
```

2. Configure environment variables in the project root `.env.local`

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

3. Start the development server

```bash
npm run dev
```

## Database Initialization

- Migration file: `supabase/migrations/00001_initial_schema.sql`
- Includes: enums, table schema, RLS, Realtime publication, and Storage bucket policies
- Push subscription table: `supabase/migrations/00002_push_subscriptions.sql`

## Web Push (End-to-End Setup)

1) Generate VAPID keys using any tool that supports `web-push`

2) Frontend environment variable:

```env
VITE_VAPID_PUBLIC_KEY=...
```

3) Supabase Edge Function secrets for the sender:

```bash
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set SUPABASE_ANON_KEY=...
```

4) Deploy the push function:

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

5) In the app settings page:
- Enable notification permission
- Send a test push notification

## Common Commands

```bash
npm run dev          # Development mode
npm run build        # Production build
npm run preview      # Local preview
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
```

## Testing

### 1) Unit Tests (Modal behavior consistency)

```bash
npm run test:unit
```

Currently covered:
- Close by clicking the overlay
- Close by clicking the close button
- Render title and content correctly

### 2) E2E Tests (Core flow regression)

Install browsers for the first time:

```bash
npm run test:e2e:install
```

Set environment variables before running:

```bash
export E2E_EMAIL="your_email"
export E2E_PASSWORD="your_password"
export E2E_BASE_URL="http://127.0.0.1:5173" # Optional
```

Run tests:

```bash
npm run test:e2e
```

Covered main path: login → bottom navigation switching → open/close dashboard modal (Esc + overlay click)

## Directory Overview

- `src/pages`: pages
- `src/components`: UI and layout components
- `src/lib`: Supabase, auth, Realtime, and error handling
- `src/stores`: Zustand stores (business state + toast)
- `supabase/migrations`: database migrations

## Notes

- This project is optimized for mobile experience. Horizontal page scrolling is locked, and only vertical scrolling is allowed.
