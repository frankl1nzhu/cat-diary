# 喵记 · Cat Diary

A mobile-first Progressive Web App for tracking your cat family's daily life — feeding, health, diary, and more — with real-time multi-user sync.

> **[中文文档 →](./README.zh.md)**

---

## Features

### Dashboard
- Cat profile card with avatar, breed, and birthday
- Weekly summary: feed count, mood stats, weight change
- Monthly mood calendar with daily emoji markers
- Quick action buttons: diary, poop log, feeding, weight, inventory, health record
- Inventory alerts with status levels (plenty / low / urgent)
- Expiry reminders with countdown (hours remaining)
- Upcoming health reminders: vaccines, deworming, medical

### Log
- Unified timeline: diary entries, poop logs, and weight records
- Diary with text, images, and tags (sleeping, eating, mischief, poop, playing, cuddling)
- Comments and emoji reactions on diary entries
- Poop tracking: Bristol scale (1–7) and color (normal/abnormal detection)
- Weight records with trend visualization
- Search and filter by entry type
- Image lightbox viewer
- Swipe-to-delete on mobile
- Pull-to-refresh

### Stats
- Weight trend chart with date range picker
- Poop statistics: Bristol scale distribution, color pie chart
- "I miss my cat" miss log
- Feeding pattern and inventory deduction trends
- Health records management (vaccine, deworming, medical history)
- Inventory tracking with expiry management
- Data export: weight, poop, miss, health, inventory, diary, mood, feed
- HTML report generation

### Settings
- Cat profile management with avatar upload
- **Family mode**: create a family, invite members via invite code, approve/reject join requests
- Family member roles: owner / admin / member
- Multi-cat support with cat switcher
- Theme switching: dark/light, preset color palettes
- Web push notification setup and test
- PWA installation prompt
- Language toggle: English / 简体中文
- Data import/export

---

## Tech Stack

| Layer        | Technology                                     |
| ------------ | ---------------------------------------------- |
| Frontend     | React 19 + TypeScript + Vite                   |
| State        | Zustand 5                                      |
| Backend / DB | Supabase (Auth, PostgreSQL, Storage, Realtime) |
| Charts       | Recharts 3                                     |
| Routing      | React Router DOM 7                             |
| PWA          | vite-plugin-pwa + Workbox                      |
| i18n         | Custom context (English + Simplified Chinese)  |
| Testing      | Vitest (unit) + Playwright (E2E)               |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

### 3. Run database migrations

Apply all migration files in order using the Supabase CLI or the Supabase dashboard SQL editor:

```
supabase/migrations/
├── 00001_initial_schema.sql        # Core tables, enums, RLS, Realtime, Storage
├── 00002_push_subscriptions.sql    # Web push subscription table
├── 00003_family_mode.sql           # Families and membership
├── 00004_family_rls_and_roles.sql  # Family RLS policies and roles
├── 00005_dissolve_and_admin.sql    # Family dissolve + admin role
├── 00006_create_join_family_rpc.sql # join_family_by_code() RPC
└── ...                             # Additional migrations
```

Or use the Supabase CLI to push all at once:

```bash
supabase db push
```

### 4. Start the development server

```bash
npm run dev
```

---

## Web Push Notifications (End-to-End Setup)

### 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

### 2. Set the public key in the frontend

```env
# .env.local
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

### 3. Set secrets in the Supabase Edge Function

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key
supabase secrets set SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Deploy the Edge Function

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

### 5. Enable in the app

Go to **Settings → Notifications**, enable permission, and send a test push.

**Supported notification types:** diary, comment, feed, health, inventory, weight, poop (abnormal), miss, cat profile update, family join request, weekly summary, and more.

---

## Family Mode

Family mode lets multiple users share a single cat's data in real time.

1. One user creates a family in **Settings → Family** and gets an invite code.
2. Other users join by entering the invite code.
3. The owner or admin approves join requests.
4. All family members see the same cats and logs, synced via Supabase Realtime.

**Roles:** `owner` → `admin` → `member`

---

## Database Schema Overview

| Table                        | Description                            |
| ---------------------------- | -------------------------------------- |
| `cats`                       | Cat profiles                           |
| `profiles`                   | User profiles (auto-created on signup) |
| `families`                   | Family groups with invite codes        |
| `family_members`             | Membership and roles                   |
| `family_join_requests`       | Join request approval workflow         |
| `diary_entries`              | Text + image diary posts with tags     |
| `mood_logs`                  | Daily mood (😸 / 😾 / 😴)                 |
| `poop_logs`                  | Bristol scale + color                  |
| `weight_records`             | Weight in kg with date                 |
| `miss_logs`                  | "I miss my cat" timestamps             |
| `feed_status`                | Feeding logs with meal type            |
| `health_records`             | Vaccine / deworming / medical history  |
| `inventory`                  | Supplies with threshold-based alerts   |
| `inventory_expiry_reminders` | Expiry tracking with countdown         |
| `push_subscriptions`         | Web push VAPID endpoints               |
| `countdowns`                 | Custom and auto-generated countdowns   |

All tables are covered by **Row Level Security (RLS)** — users can only access their own family's data.

---

## Common Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build locally
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
```

---

## Testing

### Unit Tests

Tests cover the `Modal` component behavior (overlay click, close button, title/content rendering).

```bash
npm run test:unit
```

### E2E Tests

Install browsers on first run:

```bash
npm run test:e2e:install
```

Set credentials before running:

```bash
export E2E_EMAIL="your_email"
export E2E_PASSWORD="your_password"
export E2E_BASE_URL="http://127.0.0.1:5173"  # Optional, defaults to this
```

Run E2E tests:

```bash
npm run test:e2e
```

**Covered flow:** login → bottom navigation switching → open/close dashboard modal (Esc + overlay click)

---

## Project Structure

```
src/
├── pages/          # Route-level page components
├── components/
│   ├── layout/     # AppLayout, BottomNav, CatSwitcher, QuickActionModals
│   ├── dashboard/  # Dashboard-specific cards and sections
│   └── ui/         # Reusable UI primitives (Button, Card, Modal, FAB, ...)
├── stores/         # Zustand stores (auth, cat, app, quick actions, toast)
├── hooks/          # Custom React hooks (dashboard data, pull-to-refresh)
├── lib/            # Supabase client, auth, realtime, push, i18n, utils
├── types/          # Auto-generated Supabase database types
└── assets/         # Static assets

supabase/
├── migrations/     # PostgreSQL migration files
└── functions/      # Edge Functions (send-reminders)

e2e/                # Playwright E2E test files
```

---

## Notes

- This project is optimized for **mobile experience**. Horizontal page scrolling is disabled; only vertical scrolling is supported.
- The PWA manifest uses the app name **喵记** with theme color `#f8a5c2` (pink).
- Images are compressed client-side before upload to Supabase Storage.
- Offline operations are queued and replayed when connectivity is restored.
