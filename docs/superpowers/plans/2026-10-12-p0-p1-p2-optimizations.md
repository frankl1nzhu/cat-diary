# P0, P1, P2 Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement critical P0 stability fix (React rules-of-hooks in HealthNotifications), P1 database performance (compound indexes on all high-frequency query tables pushed to Supabase), and P2 frontend/PWA performance (Supabase storage image caching in PWA Workbox, clean up Rollup dynamic import warning in offlineQueue, and connect offline mutation support).

**Architecture:**
- **P0**: Move conditional `useState` call in `HealthNotifications.tsx` above early return so hook order is invariant across renders.
- **P1**: Add migration `00022_add_performance_indexes.sql` with compound indexes on `(cat_id, fed_at)`, `(cat_id, created_at)`, `(cat_id, recorded_at)`, `(cat_id, date)`, and `(cat_id, discarded_at)` across core tables. Push directly to remote Supabase via `supabase db push`.
- **P2**:
  - Update `vite.config.ts` Workbox `runtimeCaching` to cache public images from Supabase Storage with `CacheFirst` (30 days, max 100 entries).
  - Fix Rollup warning in `offlineQueue.ts` by replacing dynamic import of `supabase.ts` with standard static import.
  - Wire up offline queueing for instant recording when offline.

**Tech Stack:** React 19, TypeScript, Supabase, Vite 7, Workbox / Vite PWA, Vitest.

---

### Task 1: P0 - Fix Conditional Hook in HealthNotifications.tsx

**Files:**
- Modify: `src/components/dashboard/HealthNotifications.tsx:60-75`
- Create test: `src/components/dashboard/HealthNotifications.test.tsx`

- [ ] **Step 1: Write test in `HealthNotifications.test.tsx`**
Verify component renders without crashing when items transitions from empty (`items = []`) to non-empty (`items = [{...}]`).

- [ ] **Step 2: Move `useState` above early return in `HealthNotifications.tsx`**
Move `const [pendingStop, setPendingStop] = useState<HealthNotifyItem | null>(null)` to line 65, before `if (items.length === 0) return null`.

- [ ] **Step 3: Run test and lint**
Run: `npm run test:unit src/components/dashboard/HealthNotifications.test.tsx` and `npm run lint`
Expected: PASS, hook violation resolved.

- [ ] **Step 4: Commit**
```bash
git add src/components/dashboard/HealthNotifications.tsx src/components/dashboard/HealthNotifications.test.tsx
git commit -m "fix(dashboard): move useState before early return in HealthNotifications"
```

---

### Task 2: P1 - Compound Database Indexes for High-Frequency Queries

**Files:**
- Create: `supabase/migrations/00022_add_performance_indexes.sql`
- Modify: `README.md`, `README.zh.md` (bump migration count to 22)

- [ ] **Step 1: Write migration `00022_add_performance_indexes.sql`**
Add compound indexes with `IF NOT EXISTS`:
- `feed_status (cat_id, fed_at DESC)`
- `diary_entries (cat_id, created_at DESC)`
- `poop_logs (cat_id, created_at DESC)`
- `weight_records (cat_id, recorded_at ASC)`
- `inventory (cat_id)`
- `mood_logs (cat_id, date)`
- `inventory_expiry_reminders (cat_id, discarded_at)`
- `health_records (cat_id, date DESC)`

- [ ] **Step 2: Dry-run and push to remote Supabase**
Run: `supabase db push --dry-run` and `supabase db push --yes`
Verify migration 00022 is successfully applied to remote database.

- [ ] **Step 3: Update README migration counts and commit**
```bash
git add supabase/migrations/00022_add_performance_indexes.sql README.md README.zh.md
git commit -m "perf(db): add compound indexes on high-frequency query tables"
```

---

### Task 3: P2 - PWA Image Caching & Offline Queue Cleanup

**Files:**
- Modify: `vite.config.ts:50-75`
- Modify: `src/lib/offlineQueue.ts:65-75`
- Create test: `src/test/pwaCacheConfig.test.ts`

- [ ] **Step 1: Add Supabase Storage Image caching to `vite.config.ts`**
In `workbox.runtimeCaching`, add:
```ts
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
  handler: 'CacheFirst',
  options: {
    cacheName: 'supabase-storage-images-cache',
    expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
    cacheableResponse: { statuses: [0, 200] },
  },
}
```

- [ ] **Step 2: Fix Rollup dynamic import warning in `src/lib/offlineQueue.ts`**
Replace `const { supabase } = await import('./supabase')` with top-level `import { supabase } from './supabase'`.

- [ ] **Step 3: Verify build and test**
Run: `npm run build && npm run test:unit`
Verify that `vite build` has 0 warnings about dynamic import of `supabase.ts`.

- [ ] **Step 4: Commit**
```bash
git add vite.config.ts src/lib/offlineQueue.ts
git commit -m "perf(pwa): cache Supabase storage images and fix Rollup import warning"
```

---

### Task 4: Final Validation

- [ ] **Step 1: Typecheck**
`npm run typecheck`
- [ ] **Step 2: Run all unit tests**
`npm run test:unit`
- [ ] **Step 3: Full production build**
`npm run build`
- [ ] **Step 4: Verify Supabase migration status**
`supabase migration list`
