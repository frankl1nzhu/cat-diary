# 喵记 Cat Diary

> A minimalist, collaborative cat care tracking app with real-time sync.

[中文文档](./README.zh.md)

---

## Overview

Cat Diary helps cat owners — solo or as a family — track their cat's daily life in one place: health records, feeding, weight, mood, and supplies. Changes sync instantly across all devices in your family group.

## Features

### Core Tracking
- **Diary** — Rich text entries with photos and mood tags (`#sleeping` `#eating` `#playing` `#poop` `#mischief` `#affectionate`)
- **Poop Logs** — Bristol Stool Scale (1–7) + color classification with abnormality alerts
- **Weight Records** — Growth tracking over time with line chart visualization
- **Feeding Status** — Breakfast, lunch, dinner, snack logging per day
- **Mood Tracking** — Daily mood calendar (😸 😾 😴) with weekly summary

### Health & Wellness
- **Health Records** — Vaccine 💉, deworming 💊, medical 🏥, vomit 🤮 event logging
- **Upcoming Reminders** — Dashboard alerts for due dates (vaccines, deworming, check-ups)
- **Inventory Management** — Track supplies with quantity, daily consumption rate, and expiry dates
- **Expiry Alerts** — Push notifications for expired or expiring supplies

### Collaboration
- **Family Groups** — Create a family with an invite code; others join by entering the code
- **Multi-cat Support** — Switch between multiple cats within the same family
- **Roles** — Owner, Admin, Member with different permissions
- **Join Requests** — Approval workflow for new family members
- **Real-time Sync** — All changes appear instantly on every connected device

### Analytics & Export
- **Weight Chart** — Line chart of historical weight
- **Poop Analytics** — Bristol type & color distribution (pie charts)
- **Inventory Analytics** — Stock levels and consumption rates
- **Data Export** — Export full reports as HTML or CSV

### App & UX
- **PWA** — Installable on mobile and desktop; works offline
- **Push Notifications** — Browser push for health and inventory reminders
- **Dark / Light Theme** — Multiple preset themes
- **Bilingual** — Full English and Chinese (Simplified/Traditional) interface
- **Quick Actions** — Floating action button for fast logging from any screen
- **Pull-to-refresh** — Mobile-native feel

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 7 |
| Routing | React Router 7 |
| State | Zustand 5 |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Charts | Recharts 3 |
| PWA | Vite PWA Plugin + Workbox |
| Notifications | Web Push API + Supabase Edge Functions |
| Performance | TanStack Virtual (virtualized lists), route-level code splitting |
| Testing | Vitest (unit) + Playwright (E2E) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone & install

```bash
git clone https://github.com/frankl1nzhu/cat-diary.git
cd cat-diary
npm install
```

### 2. Configure environment

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

> `VITE_VAPID_PUBLIC_KEY` is only required for push notifications. You can generate a VAPID key pair with `npx web-push generate-vapid-keys`.

### 3. Set up the database

Apply all migrations to your Supabase project:

```bash
npx supabase db push
```

Or apply the SQL files in `supabase/migrations/` in order via the Supabase dashboard.

### 4. Run

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run lint` | ESLint |
| `npm run test:unit` | Unit tests (Vitest) |
| `npm run test:unit:watch` | Unit tests in watch mode |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run test:e2e:ui` | E2E tests with Playwright UI |

---

## Project Structure

```
src/
├── pages/           # Route-level components (Dashboard, Log, Stats, Settings, Login)
├── components/
│   ├── ui/          # Reusable UI primitives (Modal, Toast, Lightbox, ...)
│   ├── layout/      # App shell (AppLayout, BottomNav, ...)
│   └── dashboard/   # Dashboard-specific widgets
├── stores/          # Zustand state stores (auth, cats, app, toast, quickActions)
├── hooks/           # Custom React hooks
├── lib/             # Utilities (i18n, theme, push notifications, Supabase client, ...)
└── types/           # Shared TypeScript types

supabase/
├── migrations/      # 18 ordered SQL migrations
└── functions/
    └── send-reminders/   # Daily reminder Edge Function (Deno)
```

---

## Database Overview

Core tables managed in Supabase (all protected by Row Level Security):

| Table | Purpose |
|---|---|
| `profiles` | User accounts (username, email, phone) |
| `families` | Family groups with invite codes |
| `family_members` | User–family relationships and roles |
| `family_join_requests` | Pending join requests |
| `cats` | Cat profiles (name, breed, birthday, avatar) |
| `diary_entries` | Text logs with photos and tags |
| `diary_comments` | Comments on diary entries |
| `diary_reactions` | Emoji reactions on entries |
| `poop_logs` | Bristol type and color per entry |
| `weight_records` | Weight history |
| `health_records` | Vaccine, deworming, medical, vomit events |
| `feed_status` | Daily meal records |
| `mood_logs` | Daily mood per cat |
| `inventory_items` | Supply tracking with quantities and expiry |
| `inventory_expiry_reminders` | Expiry reminder configurations |
| `push_subscriptions` | Web Push endpoint storage |

---

## Push Notifications

The app uses the Web Push API for browser notifications.

1. Generate a VAPID key pair and set `VITE_VAPID_PUBLIC_KEY` in your environment.
2. Set the corresponding `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in your Supabase project's Edge Function secrets.
3. The `send-reminders` Edge Function runs on a schedule (configured via `pg_cron`) and sends notifications for upcoming health records and low/expired inventory.

---

## License

[MIT](./LICENSE)
