# Feeding Inventory Consumption & Database Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 7 identified issues in inventory consumption during and after feeding, including rounding precision, status synchronization, zero-stock alerts, silent skips, concurrent/stale deduction, deletion restoration, and stats grams calculation, and provide a database migration for trigger-based status integrity.

**Architecture:** 
1. Database: Add migration `00021_inventory_sync_status_trigger.sql` with a trigger to automatically sync `inventory.status` with `total_quantity` and `daily_consumption` (alert threshold), and backfill inconsistent rows.
2. Core helpers: Update `computeInventoryStatus` to guarantee `urgent` for `total_quantity <= 0` even when threshold is unset, and add `roundQuantity` helper for decimal precision.
3. Feeding deduction: In `QuickActions` and `QuickActionModals`, fetch fresh stock before deduction, round to 1 decimal place, compute new status, and inform users when items lack an initial quantity.
4. Dashboard realtime: Add Realtime subscription for `inventory` table in `useDashboardData`.
5. Feed deletion restoration: In `LogPage`, restore deducted grams back to inventory upon feed record deletion, and format display labels.
6. Stats chart: In `StatsPage`, calculate actual consumed grams instead of pure feeding count, with a mode toggle.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + Realtime), Vitest, Recharts.

**Spec:** User request: "1-7修复，。数据库检查一下有没有问题"

## Global Constraints
- Do not introduce breaking schema changes for existing tables.
- All numbers representing grams should be cleanly rounded to 1 decimal place (e.g. `Math.round(val * 10) / 10`).
- Status derivation must follow: `total_quantity <= 0` -> urgent; `total_quantity <= threshold` -> urgent; `total_quantity <= threshold * 1.5` -> low; else -> plenty.
- Maintain existing English & Chinese i18n support.

## Review Focus
- Input 0 or negative stock: must result in `urgent`, even if threshold is null.
- Concurrent feeds: should deduct from fresh database quantity rather than stale React state.
- Float precision: e.g. `500.2 - 0.1` must produce `500.1`, not `500.10000000000003`.
- Deleting feed record: must return exact grams back to the matching inventory item.
- Feed without initial stock: must display clear visual notice that stock is unmanaged instead of silently failing.

---

### Task 1: Database Migration - Status Auto-Sync Trigger & Backfill

**Files:**
- Create: `supabase/migrations/00021_inventory_sync_status_trigger.sql`
- Modify: `README.md:145`, `README.zh.md:145` (update migration count)

**Interfaces:**
- Produces: PostgreSQL trigger `trigger_sync_inventory_status` on `inventory` table and backfilled statuses.

- [ ] **Step 1: Create migration `supabase/migrations/00021_inventory_sync_status_trigger.sql`**
Write the PL/pgSQL function `sync_inventory_status` and trigger `trigger_sync_inventory_status` on `inventory`:
- If `total_quantity <= 0`, set `status := 'urgent'`
- Else if `total_quantity <= daily_consumption`, set `status := 'urgent'`
- Else if `total_quantity <= daily_consumption * 1.5`, set `status := 'low'`
- Else if `daily_consumption` is not null, set `status := 'plenty'`
- Backfill existing rows in `inventory`.

- [ ] **Step 2: Update README migration counts**
Bump migration count in `README.md` and `README.zh.md` from 20 to 21.

- [ ] **Step 3: Verification**
Verify SQL syntax by running a quick syntax check or reading the SQL file.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/00021_inventory_sync_status_trigger.sql README.md README.zh.md
git commit -m "feat(db): add trigger to auto-sync inventory status and backfill"
```

---

### Task 2: Core Helpers - `computeInventoryStatus` & `roundQuantity`

**Files:**
- Modify: `src/types/database.types.ts:205-225`
- Create test: `src/test/inventoryHelpers.test.ts`

**Interfaces:**
- Consumes: `InventoryItem`, `InventoryStatus`
- Produces: `computeInventoryStatus(item: InventoryItem): InventoryStatus`, `roundQuantity(qty: number, decimals?: number): number`

- [ ] **Step 1: Write failing tests in `src/test/inventoryHelpers.test.ts`**
Test:
- `computeInventoryStatus` returns `'urgent'` when `total_quantity = 0` even if `daily_consumption = null`
- `computeInventoryStatus` returns `'urgent'` when `total_quantity < 0`
- `computeInventoryStatus` returns `'urgent'` when `total_quantity <= daily_consumption`
- `computeInventoryStatus` returns `'low'` when `total_quantity <= daily_consumption * 1.5`
- `computeInventoryStatus` returns `'plenty'` when `total_quantity > daily_consumption * 1.5`
- `roundQuantity` rounds `500.2 - 0.1` to `500.1` and `100 - 33.33` to `66.7`

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit src/test/inventoryHelpers.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `roundQuantity` and update `computeInventoryStatus` in `src/types/database.types.ts`**
Update `computeInventoryStatus`:
```ts
export function computeInventoryStatus(item: InventoryItem): InventoryStatus {
    if (item.total_quantity != null && item.total_quantity <= 0) return 'urgent'
    if (item.total_quantity == null || item.daily_consumption == null) return item.status
    if (item.total_quantity <= item.daily_consumption) return 'urgent'
    if (item.total_quantity <= item.daily_consumption * 1.5) return 'low'
    return 'plenty'
}

export function roundQuantity(qty: number, decimals = 1): number {
    const factor = Math.pow(10, decimals)
    return Math.round(qty * factor) / factor
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit src/test/inventoryHelpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/types/database.types.ts src/test/inventoryHelpers.test.ts
git commit -m "fix(inventory): fix zero-quantity status calculation and add roundQuantity"
```

---

### Task 3: Realtime Dashboard Inventory Subscription

**Files:**
- Modify: `src/hooks/useDashboardData.ts:235-245`

**Interfaces:**
- Consumes: `useRealtimeSubscription`, `loadData`
- Produces: Realtime refresh of `inventory` when changed by other devices/modals

- [ ] **Step 1: Update `src/hooks/useDashboardData.ts`**
Add `useRealtimeSubscription('inventory', () => { loadData() }, catId ? \`cat_id=eq.\${catId}\` : undefined)` alongside `feed_status` and `mood_logs`.

- [ ] **Step 2: Typecheck & unit tests**
Run: `npm run typecheck && npm run test:unit`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/hooks/useDashboardData.ts
git commit -m "fix(dashboard): subscribe to inventory realtime updates"
```

---

### Task 4: Fix Feeding Inventory Deduction in `QuickActions` & `QuickActionModals`

**Files:**
- Modify: `src/components/dashboard/QuickActions.tsx:213-264, 410-448`
- Modify: `src/components/layout/QuickActionModals.tsx:185-222, 450-485`

**Interfaces:**
- Consumes: `supabase`, `roundQuantity`, `computeInventoryStatus`
- Produces: Synchronized fresh inventory deduction, status update in DB, precision rounding, and unmanaged inventory notice

- [ ] **Step 1: Update `QuickActions.tsx` feeding handler and UI**
- In `handleFeedRecord`:
  - Fetch fresh `total_quantity` and `daily_consumption` from Supabase:
    ```ts
    const { data: freshItem } = await supabase.from('inventory').select('total_quantity, daily_consumption').eq('id', selectedInventoryItem.id).single()
    const baseQty = freshItem?.total_quantity ?? selectedInventoryItem.total_quantity
    if (baseQty != null) {
        const newQty = Math.max(0, roundQuantity(baseQty - grams, 1))
        const newStatus = computeInventoryStatus({
            ...selectedInventoryItem,
            total_quantity: newQty,
            daily_consumption: freshItem?.daily_consumption ?? selectedInventoryItem.daily_consumption,
        })
        await supabase.from('inventory')
            .update({ total_quantity: newQty, status: newStatus, updated_by: user.id })
            .eq('id', selectedInventoryItem.id)
    }
    ```
- In UI: If `selectedInventoryItem.total_quantity == null`, display hint `(未设初始库存总量，记录后不扣减库存)` / `(No initial quantity set, stock will not be deducted)`.
- [ ] **Step 2: Update `QuickActionModals.tsx` feeding handler and UI**
Apply the same fresh fetch, `roundQuantity`, `newStatus` computation, and unmanaged quantity hint.

- [ ] **Step 3: Verify and run unit tests**
Run: `npm run typecheck && npm run test:unit`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/components/dashboard/QuickActions.tsx src/components/layout/QuickActionModals.tsx
git commit -m "fix(feed): ensure fresh inventory deduction, status sync, and rounding precision"
```

---

### Task 5: Feed Record Deletion Restoration & Display Formatting in `LogPage`

**Files:**
- Modify: `src/pages/LogPage.tsx:720-730, 960-980`
- Create test: `src/test/feedDeletionRestore.test.ts`

**Interfaces:**
- Consumes: `item.data.meal_type`
- Produces: Restoration of grams to `inventory` upon feed deletion; formatted label `${name} ${grams}g` in timeline

- [ ] **Step 1: Write test for feed deletion inventory restoration logic in `src/test/feedDeletionRestore.test.ts`**
Test that parsing `meal_type` correctly extracts `itemName` and `grams`, and adds them back to inventory with `roundQuantity`.

- [ ] **Step 2: Run test to verify it passes**
Run: `npm run test:unit src/test/feedDeletionRestore.test.ts`

- [ ] **Step 3: Implement inventory restoration in `src/pages/LogPage.tsx`**
In `handleDeleteConfirm`:
```ts
if (item.type === 'feed') {
    const parts = item.data.meal_type.split('|')
    const itemName = parts[0]
    const grams = parts[1] ? parseFloat(parts[1]) : NaN
    if (itemName && !isNaN(grams) && grams > 0 && catId) {
        const { data: invItems } = await supabase.from('inventory')
            .select('*')
            .eq('cat_id', catId)
            .eq('item_name', itemName)
            .limit(1)
        if (invItems && invItems.length > 0) {
            const inv = invItems[0]
            if (inv.total_quantity != null) {
                const restoredQty = roundQuantity(inv.total_quantity + grams, 1)
                const restoredStatus = computeInventoryStatus({ ...inv, total_quantity: restoredQty })
                await supabase.from('inventory')
                    .update({ total_quantity: restoredQty, status: restoredStatus, updated_by: user?.id })
                    .eq('id', inv.id)
            }
        }
    }
    await supabase.from('feed_status').delete().eq('id', item.data.id)
}
```
In timeline feed rendering:
Format `meal_type`:
```tsx
const parts = item.data.meal_type.split('|')
const displayLabel = parts.length > 1
    ? `${parts[0]} ${parts[1]}g`
    : (MEAL_LABELS[item.data.meal_type as keyof typeof MEAL_LABELS] ?? item.data.meal_type)
```

- [ ] **Step 4: Verify and test**
Run: `npm run typecheck && npm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/pages/LogPage.tsx src/test/feedDeletionRestore.test.ts
git commit -m "fix(log): restore inventory on feed deletion and format meal label"
```

---

### Task 6: Stats Chart - Aggregate Consumed Grams with Unit & Mode Toggle

**Files:**
- Modify: `src/pages/StatsPage.tsx:379-395, 1110-1130`
- Create test: `src/test/inventoryFeedStats.test.ts`

**Interfaces:**
- Consumes: `FeedStatus[]`
- Produces: `inventoryFeedData` aggregating consumed grams (`weight`) and count, with toggle between `grams` and `times`.

- [ ] **Step 1: Write test for stats calculation in `src/test/inventoryFeedStats.test.ts`**
Test that `feeds` with `meal_type` formatted as `itemName|grams` aggregate total grams correctly.

- [ ] **Step 2: Run test to verify**
Run: `npm run test:unit src/test/inventoryFeedStats.test.ts`

- [ ] **Step 3: Implement grams aggregation and toggle in `StatsPage.tsx`**
- Add state `feedStatMode: 'grams' | 'count'` (default `'grams'`).
- In `inventoryFeedData`, compute:
  - When `feedStatMode === 'grams'`: sum of `parseFloat(parts[1])` (or 0 if missing), rounded to 1 decimal place. Slices display `${value}g`.
  - When `feedStatMode === 'count'`: count of feeding events. Slices display `${value}次`.
- In UI: Add toggle buttons above or beside the chart: `按消耗克数 (g)` / `按喂食次数 (次)`.

- [ ] **Step 4: Verify and run unit tests**
Run: `npm run typecheck && npm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/pages/StatsPage.tsx src/test/inventoryFeedStats.test.ts
git commit -m "feat(stats): aggregate inventory feed consumption by grams with toggle"
```

---

### Task 7: Full Verification & Database Sanity Audit

**Files:**
- All modified files

- [ ] **Step 1: Run typecheck**
Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run all unit tests**
Run: `npm run test:unit`
Expected: ALL PASS

- [ ] **Step 3: Run build**
Run: `npm run build`
Expected: Build succeeds without error

- [ ] **Step 4: Final verification and summary**
Review diff and summarize all changes.
