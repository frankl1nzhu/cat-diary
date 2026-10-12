# P3 & P4 Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement P3 (custom inventory units with base-gram storage & backend deduction, `feed_status.inventory_id` foreign key, offline queue mutation fallback) and P4 (form de-duplication across `QuickActions` and `QuickActionModals`, modularizing `LogPage`, and `@tanstack/react-virtual` timeline virtualization).

**Architecture:** 
1. Database schema stores all stock and consumption quantities strictly in base grams (g) as requested by user ("所有其他单位需要在克的基础上，例如一袋等于2000克，在消耗的时候后台也用克为基础"). Inventory items store `unit` (e.g. 袋/罐/支/g) and `unit_ratio` (e.g. 2000g/袋). Feeding calculates consumption in grams and deducts grams from `inventory.total_quantity`.
2. Extract common logging forms (`FeedLogForm`, `PoopLogForm`, `WeightLogForm`) into `src/components/forms/`, eliminating duplicated form state and UI across `QuickActions.tsx` and `QuickActionModals.tsx`.
3. Wrap mutation saves with offline error fallback to `enqueueOp` (`offlineQueue.ts`), syncing pending mutations on reconnect.
4. Modularize `LogPage.tsx` and integrate `@tanstack/react-virtual` for high-performance timeline virtualization.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL), Vite, PWA, Vitest, `@tanstack/react-virtual`.

**Spec:** User prompt requirement: "P3优化，但是所有其他单位需要在克的基础上，例如一袋等于2000克，在消耗的时候后台也用克为基础。p4优化。"

## Global Constraints
- Inventory `total_quantity` and `daily_consumption` in the database MUST remain in grams (g) at all times.
- Deduction on feeding MUST calculate grams (`amount * unit_ratio`) and deduct from `total_quantity` in grams.
- `feed_status.meal_type` format (`${item_name}|${grams}`) MUST be preserved for backward compatibility alongside the new `feed_status.inventory_id` foreign key.
- All code must pass `npm run typecheck`, `npm run test:unit`, and `npm run build`.

## Review Focus
1. Rounding precision when multiplying/dividing fractional unit counts (e.g. 0.5 can of 85g = 42.5g).
2. Backward compatibility for legacy inventory items where `unit` or `unit_ratio` was not previously defined (defaults to `'g'` and `1`).
3. Deletion of feed records in `LogPage`: correctly restore grams back to inventory using `inventory_id` (fallback to name match).
4. Offline queue replay compatibility with `inventory_id` and `feed_status`.
5. Virtual list height measurements and window scrolling behaviour in `@tanstack/react-virtual`.

---

### Task 1: Database Migration & Schema Types for Inventory Units & Feed Foreign Key (P3)

**Files:**
- Create: `supabase/migrations/00023_inventory_units_and_feed_foreign_key.sql`
- Modify: `src/types/database.types.ts`
- Test: `src/test/inventoryUnitHelpers.test.ts`

**Interfaces:**
- `InventoryItem`: extends with `unit: string` (default `'g'`), `unit_ratio: number` (default `1`).
- `FeedStatus`: extends with `inventory_id: string | null`.
- Helper functions in `src/types/database.types.ts`:
  - `unitToGrams(amount: number, unitRatio: number): number`
  - `gramsToUnit(grams: number, unitRatio: number): number`
  - `formatInventoryDisplay(totalGrams: number | null, unit: string, unitRatio: number): string`

- [ ] **Step 1: Write failing unit test for inventory unit conversion helpers**
Write `src/test/inventoryUnitHelpers.test.ts` testing unit-to-grams conversion, grams-to-unit conversion, and display string formatting.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit src/test/inventoryUnitHelpers.test.ts`
Expected: FAIL due to missing helper functions.

- [ ] **Step 3: Implement migration and helper functions**
- Create `supabase/migrations/00023_inventory_units_and_feed_foreign_key.sql` adding `unit` and `unit_ratio` to `inventory`, and `inventory_id` to `feed_status`.
- Update `src/types/database.types.ts` with fields and conversion helper functions.

- [ ] **Step 4: Run unit tests and typecheck**
Run: `npm run test:unit src/test/inventoryUnitHelpers.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**
`git add supabase/migrations/00023_inventory_units_and_feed_foreign_key.sql src/types/database.types.ts src/test/inventoryUnitHelpers.test.ts`
`git commit -m "feat(inventory): add unit, unit_ratio and feed inventory_id foreign key"`

---

### Task 2: Form De-duplication: Extract Shared Form Components (P4)

**Files:**
- Create: `src/components/forms/FeedLogForm.tsx`
- Create: `src/components/forms/PoopLogForm.tsx`
- Create: `src/components/forms/WeightLogForm.tsx`
- Test: `src/test/forms.test.ts`

**Interfaces:**
- `FeedLogForm`:
  - Props: `{ catId: string; userId: string; inventory: InventoryItem[]; onSaveSuccess: (optimisticFeed: FeedStatus, deductedGrams: number, inventoryId: string) => void; onCancel: () => void; }`
  - Handles item selection, unit/grams toggle, input conversion, stock deduction in grams, saving `inventory_id` to `feed_status`, offline queue fallback via `enqueueOp`.
- `PoopLogForm`:
  - Props: `{ catId: string; catName: string; userId: string; onSaveSuccess: () => void; onCancel: () => void; initialBristol?: BristolType; initialColor?: PoopColor }`
  - Handles Bristol selector, color picker, saving to `poop_logs`, abnormal poop push alert, offline queue fallback via `enqueueOp`.
- `WeightLogForm`:
  - Props: `{ catId: string; userId: string; onSaveSuccess: (weightKg: number) => void; onCancel: () => void; initialWeight?: number }`
  - Handles weight validation (0.1 to 30kg), submit, offline fallback via `enqueueOp`.

- [ ] **Step 1: Write tests for shared form helpers & validation**
Add test in `src/test/forms.test.ts` verifying calculation of deducted grams given unit count and unit ratio.

- [ ] **Step 2: Implement `FeedLogForm`, `PoopLogForm`, `WeightLogForm`**
Create clean, accessible, i18n-supported components in `src/components/forms/`.

- [ ] **Step 3: Run tests and typecheck**
Run: `npm run test:unit && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**
`git add src/components/forms/ src/test/forms.test.ts`
`git commit -m "refactor(forms): extract shared FeedLogForm, PoopLogForm, WeightLogForm"`

---

### Task 3: Integrate Shared Forms & Offline Fallback in QuickActions & QuickActionModals (P3 & P4)

**Files:**
- Modify: `src/components/dashboard/QuickActions.tsx`
- Modify: `src/components/layout/QuickActionModals.tsx`

**Interfaces:**
- `QuickActions.tsx` replaces inline feed & poop modal bodies with `<FeedLogForm />` and `<PoopLogForm />`.
- `QuickActionModals.tsx` replaces inline feed, poop, weight modal bodies with the shared forms.
- Re-use reward particles and toast notifications on success callbacks.

- [ ] **Step 1: Replace form bodies in `QuickActions.tsx`**
Clean up ~200 lines of duplicated state and JSX. Wire up `onSaveSuccess` to reward burst and data reload.

- [ ] **Step 2: Replace form bodies in `QuickActionModals.tsx`**
Clean up duplicated state and JSX in `QuickActionModals.tsx`.

- [ ] **Step 3: Run unit tests and typecheck**
Run: `npm run test:unit && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**
`git add src/components/dashboard/QuickActions.tsx src/components/layout/QuickActionModals.tsx`
`git commit -m "refactor: deduplicate QuickActions and QuickActionModals with shared forms"`

---

### Task 4: Multi-Unit Inventory Management & Alert UX (P3)

**Files:**
- Modify: `src/pages/StatsPage.tsx`
- Modify: `src/components/dashboard/InventoryAlerts.tsx`

**Interfaces:**
- In `StatsPage.tsx`:
  - Inventory modal allows selecting unit presets (`克 (g)`, `罐 (can)`, `袋 (bag)`, `支 (stick)`, `包 (pack)`, custom) and setting `unit_ratio` (grams per unit).
  - Total quantity and alert threshold inputs can be entered in that unit, with clear real-time conversion hint showing total grams.
  - Backend saves grams to `total_quantity` and `daily_consumption`.
  - Inventory list item displays both grams and unit count using `formatInventoryDisplay`.
- In `InventoryAlerts.tsx`:
  - Display badge and replenishment dialog adapted to item's `unit` and `unit_ratio`.

- [ ] **Step 1: Update `StatsPage.tsx` inventory modal and list**
Support `unit` and `unit_ratio` selection and live grams conversion.

- [ ] **Step 2: Update `InventoryAlerts.tsx` replenishment modal**
Support replenishing in units while saving grams to database.

- [ ] **Step 3: Run unit tests and typecheck**
Run: `npm run test:unit && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**
`git add src/pages/StatsPage.tsx src/components/dashboard/InventoryAlerts.tsx`
`git commit -m "feat(inventory): support unit presets, conversion to grams, and dual display"`

---

### Task 5: LogPage Timeline Virtualization & Modularity (P4)

**Files:**
- Create: `src/components/log/TimelineFilterBar.tsx`
- Create: `src/components/log/TimelineItemCard.tsx`
- Modify: `src/pages/LogPage.tsx`

**Interfaces:**
- Extract filter tabs and date/search controls into `TimelineFilterBar.tsx`.
- Extract individual timeline entry renderers into `TimelineItemCard.tsx`.
- In `LogPage.tsx`:
  - Use `@tanstack/react-virtual`'s `useWindowVirtualizer` or container virtualizer to render only visible timeline items.
  - On feed item deletion: if `item.data.inventory_id` exists, lookup inventory item by ID first (falling back to `itemName`), restoring grams cleanly.

- [ ] **Step 1: Extract `TimelineFilterBar` and `TimelineItemCard`**
Isolate presentation components from `LogPage.tsx`.

- [ ] **Step 2: Implement virtualizer in `LogPage.tsx`**
Virtualize the timeline item list using `@tanstack/react-virtual`.

- [ ] **Step 3: Update feed record deletion restore logic**
Restore deducted grams using `inventory_id` lookup when available.

- [ ] **Step 4: Run unit tests, typecheck and build**
Run: `npm run test:unit && npm run typecheck && npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**
`git add src/components/log/ src/pages/LogPage.tsx`
`git commit -m "perf(log): modularize LogPage and add timeline virtualization"`

---

### Task 6: Supabase Remote Migration & Git Push

- [ ] **Step 1: Apply migration 00023 to remote database**
Run: `npx supabase db push --yes`
Verify migration status: `npx supabase migration list`

- [ ] **Step 2: Full verification**
Run: `npm run typecheck && npm run test:unit && npm run build`

- [ ] **Step 3: Push to GitHub**
Run: `git push origin main`
Verify `git status`.
