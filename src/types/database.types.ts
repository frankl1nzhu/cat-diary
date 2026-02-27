/* ───────────────────────────────────────────────────
 *  Database types — mirrors the Supabase schema
 *  Regenerate with: npx supabase gen types typescript
 * ─────────────────────────────────────────────────── */

export type MoodType = '😸' | '😾' | '😴'

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type PoopColor = 'brown' | 'dark_brown' | 'yellow' | 'green' | 'red' | 'black' | 'white'

export type FeedStatusType = 'fed' | 'not_fed'

export type InventoryStatus = 'plenty' | 'low' | 'urgent'

export type HealthRecordType = 'vaccine' | 'deworming' | 'medical'

export type CountdownAutoType = 'birthday' | 'deworming' | 'vaccine' | null

/* ─── Row types ──────────────────────────────────── */

export interface Cat {
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

export interface Family {
    id: string
    name: string
    invite_code: string
    created_by: string | null
    created_at: string
}

export interface FamilyMember {
    id: string
    family_id: string
    user_id: string
    role: string
    created_at: string
}

export interface DiaryEntry {
    id: string
    cat_id: string
    text: string | null
    image_url: string | null
    tags: string[]
    created_by: string
    created_at: string
}

export interface MoodLog {
    id: string
    cat_id: string
    mood: MoodType
    date: string
    created_by: string
    created_at: string
}

export interface PoopLog {
    id: string
    cat_id: string
    bristol_type: BristolType
    color: PoopColor
    notes: string | null
    created_by: string
    created_at: string
}

export interface WeightRecord {
    id: string
    cat_id: string
    weight_kg: number
    recorded_at: string
    created_by: string
}

export interface HealthRecord {
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

export interface FeedStatus {
    id: string
    cat_id: string
    status: FeedStatusType
    fed_by: string | null
    fed_at: string | null
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    updated_at: string
}

export interface InventoryItem {
    id: string
    cat_id: string
    item_name: string
    status: InventoryStatus
    total_quantity: number | null
    daily_consumption: number | null
    updated_by: string | null
    updated_at: string
}

export interface Countdown {
    id: string
    cat_id: string
    title: string
    target_date: string
    auto_type: CountdownAutoType
    created_by: string
    created_at: string
}

export interface PushSubscriptionRow {
    id: string
    user_id: string
    endpoint: string
    p256dh: string
    auth: string
    created_at: string
    updated_at: string
}

export interface FamilyMemberWithEmail {
    id: string
    user_id: string
    role: string
    email: string
    created_at: string
}

/* ─── Database type for Supabase client ──────────── */

/** Compute days remaining from total_quantity / daily_consumption. */
export function computeDaysRemaining(item: InventoryItem): number | null {
    if (item.total_quantity == null || item.daily_consumption == null || item.daily_consumption <= 0) return null
    return item.total_quantity / item.daily_consumption
}

/** Derive status from days remaining: <7 = urgent, <14 = low, else plenty. */
export function computeInventoryStatus(item: InventoryItem): InventoryStatus {
    const days = computeDaysRemaining(item)
    if (days == null) return item.status // fallback to stored status
    if (days < 7) return 'urgent'
    if (days < 14) return 'low'
    return 'plenty'
}


export interface Database {
    public: {
        Tables: {
            cats: {
                Row: Cat
                Insert: Omit<Cat, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Cat, 'id'>>
                Relationships: []
            }
            families: {
                Row: Family
                Insert: Omit<Family, 'id' | 'created_at'>
                Update: Partial<Omit<Family, 'id' | 'created_at'>>
                Relationships: []
            }
            family_members: {
                Row: FamilyMember
                Insert: Omit<FamilyMember, 'id' | 'created_at'>
                Update: Partial<Omit<FamilyMember, 'id' | 'created_at'>>
                Relationships: []
            }
            diary_entries: {
                Row: DiaryEntry
                Insert: Omit<DiaryEntry, 'id' | 'created_at'>
                Update: Partial<Omit<DiaryEntry, 'id'>>
                Relationships: []
            }
            mood_logs: {
                Row: MoodLog
                Insert: Omit<MoodLog, 'id' | 'created_at'>
                Update: Partial<Omit<MoodLog, 'id'>>
                Relationships: []
            }
            poop_logs: {
                Row: PoopLog
                Insert: Omit<PoopLog, 'id' | 'created_at'>
                Update: Partial<Omit<PoopLog, 'id'>>
                Relationships: []
            }
            weight_records: {
                Row: WeightRecord
                Insert: Omit<WeightRecord, 'id'>
                Update: Partial<Omit<WeightRecord, 'id'>>
                Relationships: []
            }
            health_records: {
                Row: HealthRecord
                Insert: Omit<HealthRecord, 'id' | 'created_at'>
                Update: Partial<Omit<HealthRecord, 'id'>>
                Relationships: []
            }
            feed_status: {
                Row: FeedStatus
                Insert: Omit<FeedStatus, 'id' | 'updated_at'>
                Update: Partial<Omit<FeedStatus, 'id'>>
                Relationships: []
            }
            inventory: {
                Row: InventoryItem
                Insert: Omit<InventoryItem, 'id' | 'updated_at'>
                Update: Partial<Omit<InventoryItem, 'id'>>
                Relationships: []
            }
            countdowns: {
                Row: Countdown
                Insert: Omit<Countdown, 'id' | 'created_at'>
                Update: Partial<Omit<Countdown, 'id'>>
                Relationships: []
            }
            push_subscriptions: {
                Row: PushSubscriptionRow
                Insert: Omit<PushSubscriptionRow, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<PushSubscriptionRow, 'id' | 'created_at'>>
                Relationships: []
            }
        }
        Views: Record<string, never>
        Functions: Record<string, never>
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
