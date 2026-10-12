# Design Specification: Snooze Alerts & Stats Snoozed Dropdown

**Date**: 2026-10-12  
**Status**: Approved / Ready for Planning  
**Target Area**: Dashboard Alerts, Stats Page, Database Schema, Push Notifications

---

## 1. Intent & Context

When items in Cat Diary trigger warnings on the Dashboard (e.g. out of cat food/litter, cans reaching expiration date, or vaccine/deworming due dates approaching), users cannot always act immediately. Continuously displaying these alerts clutters the homepage and causes alert fatigue.

Users need the ability to **snooze** any alert to a chosen future date. During the snooze window, the alert must be completely hidden from the homepage. On or after that date, it resurfaces on the homepage with an updated status (e.g., "Overdue by X days" or "Due today"). Additionally, on the Stats page, if any items are currently snoozed, a top dropdown/accordion must appear showing all snoozed items with their remaining days, allowing users to inspect them or unsnooze (restore) them early.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **Three Snoozable Alert Categories**:
   - 🛒 Inventory Low/Out-of-Stock Alerts (`inventory`)
   - 📦 Item Expiry Alerts (`inventory_expiry_reminders`)
   - 🩺 Vaccine / Deworming Health Alerts (`health_records`)
2. **Dashboard Snooze Interaction**:
   - Each alert card on the Dashboard features a "⏰ 延期" (Snooze) action.
   - Clicking opens a Snooze Modal with quick presets (+3 days, +7 days, +14 days, custom date picker) defaulting to tomorrow or later.
   - Once snoozed, the item is completely hidden from Dashboard until the snooze date arrives (`today >= snoozed_until_date`).
3. **Resurfacing on Dashboard & Re-snooze**:
   - When `today >= snoozed_until_date`, the alert reappears on the Dashboard.
   - The status text reflects the snooze date (e.g. "已延期至 M/D（今日到期）" or "已延期至 M/D（已逾期 N 天）").
   - Users can click "⏰ 延期" again to choose a new, later date.
4. **Push Notification Silence**:
   - During the active snooze period (`now < snoozed_until`), both client-side local notifications and server-side Edge Function reminders (`supabase/functions/send-reminders`) are silenced for the snoozed item.
   - Once the snooze date arrives, notifications resume.
5. **Stats Page Snoozed Dropdown**:
   - Located at the very top of `StatsPage.tsx`.
   - **Conditional Visibility**: Only rendered if there is at least one active snoozed item across the 3 categories. If none are snoozed, the dropdown is completely omitted.
   - **Content**: Shows a collapsible card with badge count (e.g., `已延期提醒 (3)`). Expanding it lists all snoozed items, their category icon/name, original details, and remaining days (`剩余 X 天`).
   - **Early Restore ("提前恢复")**: Each item in the dropdown has an "提前恢复" button to clear the snooze (`snoozed_until = null`), immediately sending it back to the Dashboard.
6. **Automatic Snooze Clearance upon Item Resolution**:
   - When an inventory item is restocked, health record is renewed/completed, or expiry reminder is discarded/marked used up, `snoozed_until` is automatically cleared to `null`.
7. **Multi-device / Family Sync & Offline Queue**:
   - Snooze states are persisted to the Supabase database (`snoozed_until timestamptz`), allowing all family members to share the same alert status.
   - Offline mutations use the offline queue fallback (`enqueueOp`).

### Non-Goals
- Adding snooze to diary comments, poop logs, or weight records (they do not produce persistent alerts on the Dashboard).
- Recurring automatic snooze rules (e.g., "always snooze on weekends").

### Anti-Goals
- Do NOT permanently dismiss or delete items when snoozing.
- Do NOT hide snoozed items permanently if the date passes without user action.

---

## 3. Constraints

- Supabase PostgreSQL backend with Realtime subscriptions.
- PWA offline fallback: operations must degrade gracefully when offline.
- Date comparisons must respect local timezone boundaries (comparing date strings `YYYY-MM-DD` against `snoozed_until` date component).

---

## 4. Technical Architecture & Database Schema

### Database Changes (Migration `00024_add_snoozed_until.sql`)
Add nullable column `snoozed_until timestamptz` to:
1. `public.inventory`
2. `public.inventory_expiry_reminders`
3. `public.health_records`

Indexes:
- `idx_inventory_snoozed_until` on `inventory (cat_id, snoozed_until)`
- `idx_expiry_snoozed_until` on `inventory_expiry_reminders (cat_id, snoozed_until)`
- `idx_health_snoozed_until` on `health_records (cat_id, snoozed_until)`

### Server-side Push Notifications (`supabase/functions/send-reminders/index.ts`)
Update queries for `inventory`, `health_records`, and `inventory_expiry_reminders` in `action === 'reminder'` to exclude items where `snoozed_until > nowIso`.

### Dashboard Alert Filtering Logic (`src/hooks/useDashboardData.ts`)
For each category:
1. **Active Snooze Check**:
   An item is actively snoozed if `item.snoozed_until != null` and `format(new Date(item.snoozed_until), 'yyyy-MM-dd') > today`.
2. **Homepage Visibility**:
   - If actively snoozed: **EXCLUDED** from Dashboard alert lists (`lowInventory`, `allInventoryExpiryReminders`, `urgentHealthReminders`).
   - If snooze date is reached or passed (`format(new Date(item.snoozed_until), 'yyyy-MM-dd') <= today`): **INCLUDED** on Dashboard alert lists, with metadata `isSnoozedOverdue: true` and `snoozedDateText`.

### Stats Page Top Dropdown (`src/components/stats/SnoozedAlertsDropdown.tsx`)
1. Receives/computes all currently actively snoozed items for the current cat.
2. If `activeSnoozedItems.length === 0`, return `null`.
3. If `activeSnoozedItems.length > 0`, render `<Card className="snoozed-dropdown-card">`:
   - Summary header: `⏰ 已延期提醒 (${count})` with toggle expand/collapse icon.
   - Expanded list:
     - Icon + Name (e.g., 🛒 渴望猫粮, 📦 巅峰罐头, 🩺 妙三联疫苗).
     - Snoozed target date & countdown (`延期至 M/D，剩余 N 天`).
     - Action button: `提前恢复` (sets `snoozed_until` to `null`).

---

## 5. UI/UX Details

### Snooze Modal (`src/components/ui/SnoozeModal.tsx`)
- Props:
  - `isOpen: boolean`
  - `title: string` (e.g., `延期「渴望猫粮」提醒`)
  - `onClose: () => void`
  - `onConfirm: (snoozedUntilDate: string) => Promise<void>`
  - `onClearSnooze?: () => Promise<void>` (optional secondary action to cancel snooze)
- UI Elements:
  - Quick buttons: `+3天` (sets date to today + 3), `+7天` (today + 7), `+14天` (today + 14).
  - Date input: `<input type="date" min={tomorrow} ... />`.
  - Confirm / Cancel buttons.

---

## 6. Left to Builder
- Visual styling conforming to existing CSS variables (`--color-primary`, `--color-bg-card`, etc.).
- Exact translation keys in `i18n.ts` for English and Chinese.
- Dedicated unit tests for snooze filtering helpers and component rendering.
