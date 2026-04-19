/* ───────────────────────────────────────────────────
 *  Database types — mirrors the Supabase schema
 *  Regenerate with: npx supabase gen types typescript
 * ─────────────────────────────────────────────────── */

export type MoodType = '😸' | '😾' | '😴'

export type BristolType = '1' | '2' | '3' | '4' | '5' | '6' | '7'

export type PoopColor = 'brown' | 'dark_brown' | 'yellow' | 'green' | 'red' | 'black' | 'white'

export type FeedStatusType = 'fed' | 'not_fed'

export type InventoryStatus = 'plenty' | 'low' | 'urgent'

export type HealthRecordType = 'vaccine' | 'deworming' | 'medical'

export type CountdownAutoType = 'birthday' | 'deworming' | 'vaccine' | null

/* ─── Row types ──────────────────────────────────── */

export type Cat = {
    id: string
    name: string
    birthday: string | null
    breed: string | null
    avatar_url: string | null
    adopted_at: string | null
    family_id: string | null
    created_by: string
    created_at: string
    updated_at: string
}

export type Family = {
    id: string
    name: string
    invite_code: string
    created_by: string | null
    created_at: string
}

export type FamilyRole = 'owner' | 'admin' | 'member'

export type FamilyMember = {
    id: string
    family_id: string
    user_id: string
    role: FamilyRole
    created_at: string
}

export type FamilyJoinRequest = {
    id: string
    family_id: string
    user_id: string
    status: 'pending' | 'approved' | 'rejected'
    requested_at: string
    reviewed_by: string | null
    reviewed_at: string | null
}

export type Profile = {
    id: string
    username: string
    phone: string | null
    email: string | null
    created_at: string
}

export type DiaryEntry = {
    id: string
    cat_id: string
    text: string | null
    image_url: string | null
    tags: string[]
    created_by: string
    created_at: string
}

export type MoodLog = {
    id: string
    cat_id: string
    mood: MoodType
    date: string
    created_by: string
    created_at: string
}

export type PoopLog = {
    id: string
    cat_id: string
    bristol_type: BristolType
    color: PoopColor
    notes: string | null
    created_by: string
    created_at: string
}

export type WeightRecord = {
    id: string
    cat_id: string
    weight_kg: number
    recorded_at: string
    created_by: string
}

export type HealthRecord = {
    id: string
    cat_id: string
    type: HealthRecordType
    name: string
    date: string
    next_due: string | null
    image_url: string | null
    notes: string | null
    created_by: string
    created_at: string
}

export type FeedStatus = {
    id: string
    cat_id: string
    status: FeedStatusType
    fed_by: string | null
    fed_at: string | null
    meal_type: string
    updated_at: string
}

export type InventoryItem = {
    id: string
    cat_id: string
    item_name: string
    icon: string | null
    status: InventoryStatus
    total_quantity: number | null
    daily_consumption: number | null
    updated_by: string | null
    updated_at: string
}

export type InventoryExpiryReminder = {
    id: string
    cat_id: string
    item_name: string
    expires_at: string
    discarded_at: string | null
    created_by: string | null
    created_at: string
}

export type Countdown = {
    id: string
    cat_id: string
    title: string
    target_date: string
    auto_type: CountdownAutoType
    created_by: string
    created_at: string
}

export type PushSubscriptionRow = {
    id: string
    user_id: string
    endpoint: string
    p256dh: string
    auth: string
    created_at: string
    updated_at: string
}

export type FamilyMemberWithEmail = {
    id: string
    user_id: string
    role: FamilyRole
    email: string
    created_at: string
}

export type DiaryComment = {
    id: string
    diary_id: string
    user_id: string
    text: string
    created_at: string
}

export type DiaryReaction = {
    id: string
    diary_id: string
    user_id: string
    emoji: string
    created_at: string
}

export type MissLog = {
    id: string
    cat_id: string
    created_by: string
    created_at: string
}

/* ─── Inventory helpers ───────────────────────────── */

/** Compute days remaining — no longer used (threshold-based alerts now). */
export function computeDaysRemaining(_item: InventoryItem): number | null {
    return null
}

/** Derive status from total_quantity vs alert threshold (stored in daily_consumption field).
 *  At or below threshold → urgent, within 1.5x threshold → low, else plenty. */
export function computeInventoryStatus(item: InventoryItem): InventoryStatus {
    if (item.total_quantity == null || item.daily_consumption == null) return item.status
    if (item.total_quantity <= item.daily_consumption) return 'urgent'
    if (item.total_quantity <= item.daily_consumption * 1.5) return 'low'
    return 'plenty'
}

/** Compute integer hours to expiry (negative means already expired). */
export function computeInventoryExpiryHoursLeft(
    reminder: Pick<InventoryExpiryReminder, 'expires_at'>,
    now = new Date(),
): number {
    const diffMs = new Date(reminder.expires_at).getTime() - now.getTime()
    const oneHourMs = 1000 * 60 * 60
    if (diffMs >= 0) return Math.ceil(diffMs / oneHourMs)
    return Math.floor(diffMs / oneHourMs)
}

/* ─── Database type for Supabase client ──────────── */

/**
 * Supabase SDK v2.95+ requires Insert/Update to satisfy Record<string, unknown>.
 * TypeScript's Omit<> creates mapped types that don't, so we intersect explicitly.
 * NullableOptional makes fields that accept null also optional (matching real DB defaults).
 */
type NullableKeys<T> = { [K in keyof T]: null extends T[K] ? K : never }[keyof T]
type NullableOptional<T> = Omit<T, NullableKeys<T>> & Partial<Pick<T, NullableKeys<T>>>
type DbInsert<T, K extends keyof T> = NullableOptional<Omit<T, K>> & Record<string, unknown>
type DbUpdate<T, K extends keyof T> = Partial<Omit<T, K>> & Record<string, unknown>

export interface Database {
    public: {
        Tables: {
            cats: {
                Row: Cat
                Insert: DbInsert<Cat, 'id' | 'created_at' | 'updated_at'>
                Update: DbUpdate<Cat, 'id'>
                Relationships: []
            }
            families: {
                Row: Family
                Insert: DbInsert<Family, 'id' | 'created_at'>
                Update: DbUpdate<Family, 'id' | 'created_at'>
                Relationships: []
            }
            family_members: {
                Row: FamilyMember
                Insert: DbInsert<FamilyMember, 'id' | 'created_at'>
                Update: DbUpdate<FamilyMember, 'id' | 'created_at'>
                Relationships: []
            }
            family_join_requests: {
                Row: FamilyJoinRequest
                Insert: DbInsert<FamilyJoinRequest, 'id' | 'status' | 'reviewed_by' | 'reviewed_at' | 'requested_at'>
                Update: DbUpdate<FamilyJoinRequest, 'id' | 'requested_at'>
                Relationships: []
            }
            profiles: {
                Row: Profile
                Insert: DbInsert<Profile, 'created_at'>
                Update: DbUpdate<Profile, 'id' | 'created_at'>
                Relationships: []
            }
            diary_entries: {
                Row: DiaryEntry
                Insert: DbInsert<DiaryEntry, 'id' | 'created_at'>
                Update: DbUpdate<DiaryEntry, 'id'>
                Relationships: []
            }
            mood_logs: {
                Row: MoodLog
                Insert: DbInsert<MoodLog, 'id' | 'created_at'>
                Update: DbUpdate<MoodLog, 'id'>
                Relationships: []
            }
            poop_logs: {
                Row: PoopLog
                Insert: DbInsert<PoopLog, 'id' | 'created_at'>
                Update: DbUpdate<PoopLog, 'id'>
                Relationships: []
            }
            miss_logs: {
                Row: MissLog
                Insert: DbInsert<MissLog, 'id' | 'created_at'>
                Update: DbUpdate<MissLog, 'id'>
                Relationships: []
            }
            weight_records: {
                Row: WeightRecord
                Insert: DbInsert<WeightRecord, 'id'>
                Update: DbUpdate<WeightRecord, 'id'>
                Relationships: []
            }
            health_records: {
                Row: HealthRecord
                Insert: DbInsert<HealthRecord, 'id' | 'created_at'>
                Update: DbUpdate<HealthRecord, 'id'>
                Relationships: []
            }
            feed_status: {
                Row: FeedStatus
                Insert: DbInsert<FeedStatus, 'id' | 'updated_at'> & { updated_at?: string }
                Update: DbUpdate<FeedStatus, 'id'>
                Relationships: []
            }
            inventory: {
                Row: InventoryItem
                Insert: DbInsert<InventoryItem, 'id' | 'updated_at'> & { updated_at?: string }
                Update: DbUpdate<InventoryItem, 'id'>
                Relationships: []
            }
            inventory_expiry_reminders: {
                Row: InventoryExpiryReminder
                Insert: DbInsert<InventoryExpiryReminder, 'id' | 'created_at'>
                Update: DbUpdate<InventoryExpiryReminder, 'id'>
                Relationships: []
            }
            countdowns: {
                Row: Countdown
                Insert: DbInsert<Countdown, 'id' | 'created_at'>
                Update: DbUpdate<Countdown, 'id'>
                Relationships: []
            }
            push_subscriptions: {
                Row: PushSubscriptionRow
                Insert: DbInsert<PushSubscriptionRow, 'id' | 'created_at' | 'updated_at'>
                Update: DbUpdate<PushSubscriptionRow, 'id' | 'created_at'>
                Relationships: []
            }
            diary_comments: {
                Row: DiaryComment
                Insert: DbInsert<DiaryComment, 'id' | 'created_at'>
                Update: DbUpdate<DiaryComment, 'id'>
                Relationships: []
            }
            diary_reactions: {
                Row: DiaryReaction
                Insert: DbInsert<DiaryReaction, 'id' | 'created_at'>
                Update: DbUpdate<DiaryReaction, 'id'>
                Relationships: []
            }
        }
        Views: Record<string, never>
        Functions: {
            create_family_with_owner: {
                Args: { family_name: string }
                Returns: Record<string, unknown>
            }
            join_family_by_code: {
                Args: { code: string }
                Returns: Record<string, unknown>
            }
            request_join_family_by_code: {
                Args: { code: string }
                Returns: Record<string, unknown>
            }
            approve_family_join_request: {
                Args: { req_id: string; approve: boolean }
                Returns: Record<string, unknown>
            }
            dissolve_family: {
                Args: { target_family_id: string }
                Returns: undefined
            }
            get_family_members_with_email: {
                Args: { target_family_id: string }
                Returns: FamilyMemberWithEmail[]
            }
        }
        Enums: {
            mood_type: MoodType
            bristol_type: BristolType
            poop_color: PoopColor
            feed_status_type: FeedStatusType
            inventory_status: InventoryStatus
            health_record_type: HealthRecordType
        }
    }
}
