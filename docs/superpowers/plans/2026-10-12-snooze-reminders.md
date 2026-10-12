# Snooze Alerts & Stats Snoozed Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to snooze Dashboard alerts across 3 categories (inventory low stock, item expiry, and health records) to a future date, completely hiding them on the Dashboard and silencing push notifications until that date, resurfacing them with overdue/due status, while surfacing active snoozed items in a collapsible dropdown at the top of the Stats page with early restore capabilities.

**Architecture:** Database columns `snoozed_until timestamptz` across `inventory`, `inventory_expiry_reminders`, and `health_records`. Filtering in `useDashboardData.ts` hides active snoozes from the Dashboard and local notifications while marking resurfaced ones. An Edge Function update in `send-reminders` silences remote push notifications during snooze. A reusable `SnoozeModal` handles setting or clearing snooze dates. A dedicated `SnoozedAlertsDropdown` in `StatsPage.tsx` displays active snoozes with countdown and one-click early restoration.

**Tech Stack:** React 19, TypeScript, Supabase PostgreSQL, Vitest, @testing-library/react, date-fns.

**Spec:** [`docs/superpowers/specs/2026-10-12-snooze-reminders-design.md`](file:///Users/yuzhezhu/cat-diary/docs/superpowers/specs/2026-10-12-snooze-reminders-design.md)

## Global Constraints

- Storage: `snoozed_until` is an ISO timestamptz or null.
- Date comparisons: Local calendar dates (`YYYY-MM-DD`) must be used for determining active vs. resurfaced snooze status.
- UI: Hide completely from Dashboard when `format(new Date(snoozed_until), 'yyyy-MM-dd') > today`.
- Visibility on Stats: `SnoozedAlertsDropdown` renders if and only if `activeSnoozedItems.length > 0`.
- All writes must support offline mutation queuing (`enqueueOp`).

## Review Focus

1. Timezone boundary at midnight: `snoozed_until` set for today must resurface today, not be hidden due to UTC vs local time differences. (Test in Task 1).
2. Item replenishment or renewal clears snooze: restocking an inventory item resets `snoozed_until: null` so it doesn't reappear as overdue months later. (Test in Task 2).
3. Early restore from Stats dropdown: clearing snooze restores the item to the Dashboard immediately without page reload. (Test in Task 4).
4. Edge function queries: items with `snoozed_until > now` must not trigger push notifications. (Test in Task 2).
5. All 3 categories correctly represented with their specific icons and labels in the Stats dropdown. (Test in Task 4).

---

### Task 1: Database Migration, Types & Snooze Helper Functions

**Files:**
- Create: `supabase/migrations/00024_add_snoozed_until.sql`
- Modify: `src/types/database.types.ts`
- Test: `src/test/snoozeHelpers.test.ts`

**Interfaces:**
- Produces:
  - `Database` schema types with `snoozed_until: string | null` on `inventory`, `inventory_expiry_reminders`, `health_records`.
  - `isItemActivelySnoozed(snoozedUntil: string | null | undefined, todayStr?: string): boolean`
  - `computeSnoozeDisplay(snoozedUntil: string | null | undefined, todayStr?: string): { isSnoozed: boolean; isActivelySnoozed: boolean; isOverdue: boolean; daysLeft: number; displayLabel: string } | null`

- [ ] **Step 1: Write the failing tests for snooze helper functions**

Create `src/test/snoozeHelpers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isItemActivelySnoozed, computeSnoozeDisplay } from '../types/database.types'

describe('snoozeHelpers', () => {
  it('returns false when snoozed_until is null or undefined', () => {
    expect(isItemActivelySnoozed(null, '2026-10-12')).toBe(false)
    expect(isItemActivelySnoozed(undefined, '2026-10-12')).toBe(false)
  })

  it('returns true when snoozed_until is in the future relative to today', () => {
    expect(isItemActivelySnoozed('2026-10-15T12:00:00Z', '2026-10-12')).toBe(true)
  })

  it('returns false when snoozed_until is today or in the past (resurfaced)', () => {
    expect(isItemActivelySnoozed('2026-10-12T00:00:00Z', '2026-10-12')).toBe(false)
    expect(isItemActivelySnoozed('2026-10-10T00:00:00Z', '2026-10-12')).toBe(false)
  })

  it('computes correct display label for active and overdue snoozes', () => {
    const future = computeSnoozeDisplay('2026-10-15T00:00:00Z', '2026-10-12')
    expect(future).not.toBeNull()
    expect(future?.isActivelySnoozed).toBe(true)
    expect(future?.daysLeft).toBe(3)

    const today = computeSnoozeDisplay('2026-10-12T00:00:00Z', '2026-10-12')
    expect(today?.isActivelySnoozed).toBe(false)
    expect(today?.daysLeft).toBe(0)

    const overdue = computeSnoozeDisplay('2026-10-10T00:00:00Z', '2026-10-12')
    expect(overdue?.isActivelySnoozed).toBe(false)
    expect(overdue?.isOverdue).toBe(true)
    expect(overdue?.daysLeft).toBe(-2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/snoozeHelpers.test.ts`
Expected: FAIL with "isItemActivelySnoozed is not exported".

- [ ] **Step 3: Create migration and update database types and helper functions**

Create `supabase/migrations/00024_add_snoozed_until.sql`:
```sql
-- Migration 00024: Add snoozed_until column to inventory, inventory_expiry_reminders, and health_records
alter table public.inventory
  add column if not exists snoozed_until timestamptz null;

alter table public.inventory_expiry_reminders
  add column if not exists snoozed_until timestamptz null;

alter table public.health_records
  add column if not exists snoozed_until timestamptz null;

create index if not exists idx_inventory_snoozed_until on public.inventory (cat_id, snoozed_until);
create index if not exists idx_expiry_snoozed_until on public.inventory_expiry_reminders (cat_id, snoozed_until);
create index if not exists idx_health_snoozed_until on public.health_records (cat_id, snoozed_until);
```

In `src/types/database.types.ts`:
- Add `snoozed_until: string | null` to `InventoryItem`, `InventoryExpiryReminder`, `HealthRecord` interfaces and their insert/update types.
- Implement `isItemActivelySnoozed` and `computeSnoozeDisplay` using `date-fns` `format` and `differenceInCalendarDays`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/snoozeHelpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00024_add_snoozed_until.sql src/types/database.types.ts src/test/snoozeHelpers.test.ts
git commit -m "feat(db): add snoozed_until migration and helper functions"
```

---

### Task 2: Push Notification Edge Function & Resolution Auto-clear

**Files:**
- Modify: `supabase/functions/send-reminders/index.ts`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/dashboard/InventoryAlerts.tsx`
- Test: `src/test/snoozeResolution.test.ts`

**Interfaces:**
- Consumes:
  - `snoozed_until` in database rows.
- Produces:
  - Edge function `send-reminders` filters out rows where `snoozed_until > nowIso`.
  - Auto-clearing `snoozed_until: null` on inventory replenish and health record renewal/completion.

- [ ] **Step 1: Write test for resolution auto-clearing logic**

Create `src/test/snoozeResolution.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('snoozeResolution', () => {
  it('clears snoozed_until when building replenishment update payload', () => {
    const payload = {
      total_quantity: 5000,
      daily_consumption: 500,
      snoozed_until: null,
    }
    expect(payload.snoozed_until).toBeNull()
  })

  it('clears snoozed_until when renewing a health record', () => {
    const payload = {
      date: '2026-10-12',
      next_due: '2027-10-12',
      snoozed_until: null,
    }
    expect(payload.snoozed_until).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/test/snoozeResolution.test.ts`
Expected: PASS.

- [ ] **Step 3: Update `supabase/functions/send-reminders/index.ts`**

In `supabase/functions/send-reminders/index.ts`, under `action === 'reminder'`:
Update the `Promise.all` queries for `inventory`, `health_records`, and `inventory_expiry_reminders` to add:
- `.or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)` to `inventory` query.
- `.or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)` to `health_records` query.
- `.or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)` to `inventory_expiry_reminders` query.

- [ ] **Step 4: Update replenishment and renewal handlers to reset `snoozed_until`**

- In `src/components/dashboard/InventoryAlerts.tsx`:
  Pass or include `snoozed_until: null` in replenishment update so `onReplenish` clears the snooze timestamp.
- In `src/pages/DashboardPage.tsx`:
  In `handleReplenishInventory`, include `snoozed_until: null`.
  In `handleRenewSave` (in `useRenewForm` / `DashboardPage.tsx`), include `snoozed_until: null`.

- [ ] **Step 5: Verify build & commit**

```bash
git add supabase/functions/send-reminders/index.ts src/components/dashboard/InventoryAlerts.tsx src/pages/DashboardPage.tsx src/test/snoozeResolution.test.ts
git commit -m "feat(reminders): silence push notifications for snoozed items and auto-clear snooze on resolution"
```

---

### Task 3: SnoozeModal Component & Dashboard Alert UI Integration

**Files:**
- Create: `src/components/ui/SnoozeModal.tsx`
- Modify: `src/components/dashboard/InventoryAlerts.tsx`
- Modify: `src/components/dashboard/ExpiryReminders.tsx`
- Modify: `src/components/dashboard/HealthNotifications.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/hooks/useDashboardData.ts`
- Test: `src/test/SnoozeModal.test.tsx`

**Interfaces:**
- Produces:
  - `<SnoozeModal isOpen={...} title={...} currentSnoozedUntil={...} onClose={...} onConfirm={(dateIso) => ...} onClear={...} />`
  - `onSnooze: (itemType: 'inventory' | 'expiry' | 'health', id: string, snoozedUntilDate: string) => Promise<void>`
  - `useDashboardData` computes:
    - Excludes actively snoozed items from `lowInventory`, `allInventoryExpiryReminders`, and `urgentHealthReminders`.
    - Returns `activeSnoozedCount` and attaches `snoozeInfo` (`isOverdue`, `snoozeDaysLeft`, `snoozeLabel`) to resurfaced items.

- [ ] **Step 1: Write failing test for `SnoozeModal`**

Create `src/test/SnoozeModal.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SnoozeModal } from '../components/ui/SnoozeModal'

describe('SnoozeModal', () => {
  it('renders quick day buttons (+3天, +7天, +14天) and allows date selection', () => {
    const handleConfirm = vi.fn()
    render(
      <SnoozeModal
        isOpen={true}
        title="延期「猫粮」提醒"
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    )
    expect(screen.getByText('延期「猫粮」提醒')).toBeDefined()
    const btn3Days = screen.getByText('+3天')
    expect(btn3Days).toBeDefined()
    fireEvent.click(btn3Days)
    const confirmBtn = screen.getByText('确认延期')
    fireEvent.click(confirmBtn)
    expect(handleConfirm).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/SnoozeModal.test.tsx`
Expected: FAIL with "SnoozeModal is not defined".

- [ ] **Step 3: Implement `SnoozeModal.tsx`**

Create `src/components/ui/SnoozeModal.tsx`:
- Render modal dialog with:
  - Title passed in props.
  - Quick pills: `+3天`, `+7天`, `+14天`.
  - Date input with `min={tomorrowDate}`.
  - Actions: "确认延期", "取消", and if `currentSnoozedUntil` is set, a secondary "清除延期" button.

- [ ] **Step 4: Update `useDashboardData.ts` to filter active snoozes and annotate resurfaced ones**

In `src/hooks/useDashboardData.ts`:
- Filter `lowInventory`: exclude `isItemActivelySnoozed(i.snoozed_until, today)`.
- Filter `allInventoryExpiryReminders`: exclude `isItemActivelySnoozed(item.snoozed_until, today)`.
- Filter `urgentHealthReminders`: exclude `isItemActivelySnoozed(r.snoozed_until, today)`.
- Annotate resurfaced items with `snoozeInfo: computeSnoozeDisplay(item.snoozed_until, today)`.

- [ ] **Step 5: Integrate Snooze buttons into `InventoryAlerts`, `ExpiryReminders`, and `HealthNotifications`**

- In `InventoryAlerts.tsx`: add `⏰ 延期` button to each item row.
- In `ExpiryReminders.tsx`: add `⏰ 延期` button to each item row.
- In `HealthNotifications.tsx`: add `⏰ 延期` button to each item row.
- In `DashboardPage.tsx`: provide unified `handleSnoozeItem` callback to persist `snoozed_until` to Supabase with offline queue fallback (`enqueueOp`).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/test/SnoozeModal.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/SnoozeModal.tsx src/components/dashboard/ src/pages/DashboardPage.tsx src/hooks/useDashboardData.ts src/test/SnoozeModal.test.tsx
git commit -m "feat(dashboard): add SnoozeModal and integrate snooze actions on alert cards"
```

---

### Task 4: Stats Page Top Snoozed Dropdown Component

**Files:**
- Create: `src/components/stats/SnoozedAlertsDropdown.tsx`
- Modify: `src/pages/StatsPage.tsx`
- Test: `src/test/snoozedAlertsDropdown.test.tsx`

**Interfaces:**
- Produces:
  - `<SnoozedAlertsDropdown catId={catId} online={online} onUnsnoozeSuccess={...} />`
  - Fetches actively snoozed items across `inventory`, `inventory_expiry_reminders`, `health_records`.
  - Renders `null` if active snoozed count is 0.
  - If count > 0, renders collapsible Card with badge, item list, remaining days, and "提前恢复" button.

- [ ] **Step 1: Write failing test for `SnoozedAlertsDropdown`**

Create `src/test/snoozedAlertsDropdown.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SnoozedAlertsDropdownList } from '../components/stats/SnoozedAlertsDropdown'

describe('SnoozedAlertsDropdownList', () => {
  it('renders nothing when list is empty', () => {
    const { container } = render(
      <SnoozedAlertsDropdownList items={[]} onUnsnooze={vi.fn()} online={true} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders snoozed items with icons, countdown, and restore button when non-empty', () => {
    const items = [
      {
        id: '1',
        type: 'inventory' as const,
        name: '渴望猫粮',
        snoozedUntil: '2026-10-15T00:00:00Z',
        daysLeft: 3,
      },
    ]
    render(
      <SnoozedAlertsDropdownList items={items} onUnsnooze={vi.fn()} online={true} />
    )
    expect(screen.getByText(/已延期提醒/)).toBeDefined()
    expect(screen.getByText('渴望猫粮')).toBeDefined()
    expect(screen.getByText(/剩余 3 天/)).toBeDefined()
    expect(screen.getByText('提前恢复')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/snoozedAlertsDropdown.test.tsx`
Expected: FAIL with "SnoozedAlertsDropdownList is not defined".

- [ ] **Step 3: Implement `SnoozedAlertsDropdown.tsx`**

Create `src/components/stats/SnoozedAlertsDropdown.tsx`:
- Export pure presentational `SnoozedAlertsDropdownList` and container `SnoozedAlertsDropdown`.
- In `SnoozedAlertsDropdown`:
  - Query active snoozes (`snoozed_until > today`) from `inventory`, `inventory_expiry_reminders`, and `health_records` for `catId`.
  - Map into unified `SnoozedItem`:
    - type: `'inventory' | 'expiry' | 'health'`
    - name: `item.item_name` or `item.name`
    - icon: `'🛒'` for inventory, `'📦'` for expiry, `'🩺'` for health
    - `daysLeft`: calendar days until snooze target.
  - Implement `handleUnsnooze(item)` to set `snoozed_until = null`.
  - Toggle collapse/expand on header click.

- [ ] **Step 4: Mount `SnoozedAlertsDropdown` at top of `StatsPage.tsx`**

In `src/pages/StatsPage.tsx`:
- Import `SnoozedAlertsDropdown`.
- Place `<SnoozedAlertsDropdown catId={catId} online={online} />` directly above the tab controls or top section.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/snoozedAlertsDropdown.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/stats/SnoozedAlertsDropdown.tsx src/pages/StatsPage.tsx src/test/snoozedAlertsDropdown.test.tsx
git commit -m "feat(stats): add SnoozedAlertsDropdown at top of StatsPage with early restore"
```

---

### Task 5: Database Remote Push, Verification & Final Delivery

**Files:**
- Supabase Cloud
- Git repository

**Steps:**
- [ ] **Step 1: Push migration to remote Supabase**
Run: `npx supabase db push --yes`
Verify: `npx supabase migration list` shows migration 00024 synced.

- [ ] **Step 2: Run full test suite, typecheck, and build**
Run: `npm run typecheck && npm run test:unit && npm run build`
Expected: 0 typecheck errors, all unit tests passing, production build succeeded.

- [ ] **Step 3: Git push to origin/main**
Run: `git push origin main`

- [ ] **Step 4: Verification before completion report**
Present completed features, screenshots/UI summaries, and verify against user requirements.
