/* ─── Shared constants ──────────────────────────────
 *  Deduplicated labels and helpers used across pages.
 * ──────────────────────────────────────────────────── */

import type { BristolType, PoopColor } from '../types/database.types'

/** Bristol stool scale — base labels. */
export const BRISTOL_LABELS: Record<BristolType, string> = {
    '1': '硬球状',
    '2': '腊肠状硬块',
    '3': '腊肠状裂纹',
    '4': '软条状 ✅',
    '5': '软团状',
    '6': '泥状',
    '7': '水状',
}

/** Poop color labels with emoji and description. */
export const POOP_COLOR_LABELS: Record<PoopColor, string> = {
    brown: '🟫 棕色（正常）',
    dark_brown: '⬛ 深棕色',
    yellow: '🟨 黄色',
    green: '🟩 绿色',
    red: '🟥 红色 ⚠️',
    black: '⬛ 黑色 ⚠️',
    white: '⬜ 白色 ⚠️',
}

/** Poop color emojis only (for compact timeline display). */
export const POOP_COLOR_EMOJIS: Record<PoopColor, string> = {
    brown: '🟧',
    dark_brown: '⬛',
    yellow: '🟨',
    green: '🟩',
    red: '🟥',
    black: '⬛',
    white: '⬜',
}

/** Meal type labels. */
export const MEAL_LABELS: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
    breakfast: '🌅 早餐',
    lunch: '☀️ 午餐',
    dinner: '🌙 晚餐',
    snack: '🍬 干粮',
}

/** Pre-defined diary tags. */
export const DIARY_TAGS = ['睡觉', '干饭', '捣乱', '便便', '玩耍', '撒娇'] as const

type DiaryTag = (typeof DIARY_TAGS)[number]

/** Diary tag display labels by language, while keeping stored values unchanged. */
export const DIARY_TAG_LABELS: Record<DiaryTag, { zh: string; en: string }> = {
    睡觉: { zh: '睡觉', en: 'Sleep' },
    干饭: { zh: '干饭', en: 'Meal' },
    捣乱: { zh: '捣乱', en: 'Chaos' },
    便便: { zh: '便便', en: 'Poop' },
    玩耍: { zh: '玩耍', en: 'Play' },
    撒娇: { zh: '撒娇', en: 'Cuddle' },
}

/** Resolve diary tag label for current language, with fallback for historical custom values. */
export function getDiaryTagLabel(tag: string, language: 'zh' | 'en'): string {
    const key = tag as DiaryTag
    const labels = DIARY_TAG_LABELS[key]
    if (!labels) return tag
    return labels[language]
}

/** Inventory icon options for different food / supply types. */
export const INVENTORY_ICONS = [
    { value: '🐟', label: '鱼' },
    { value: '🍗', label: '鸡肉' },
    { value: '🥩', label: '牛肉' },
    { value: '🫙', label: '罐头' },
    { value: '🍚', label: '猫粮' },
    { value: '🧊', label: '冻干' },
    { value: '🥣', label: '主食罐' },
    { value: '🍬', label: '零食' },
    { value: '🪣', label: '猫砂' },
    { value: '💊', label: '药品' },
    { value: '🧴', label: '清洁' },
    { value: '🧶', label: '玩具' },
    { value: '📦', label: '其他' },
] as const

/** Check if a poop record indicates abnormal health. */
export function isAbnormalPoop(bristolType: BristolType | string, color: PoopColor | string): boolean {
    return Number(bristolType) >= 6 || ['red', 'black', 'white'].includes(color)
}

/* ─── Storage Key Constants ────────────────────────
 *  Centralized keys for localStorage & sessionStorage
 *  to prevent typos and make refactoring easier.
 * ────────────────────────────────────────────────── */
export const STORAGE_KEYS = {
    /** Push notification auto-prompt attempt (sessionStorage) */
    AUTO_PUSH_PROMPT: 'cat_diary_auto_push_prompt_attempted',
    /** Local notification: inventory reminder (localStorage, per-day) */
    notifyInventory: (todayKey: string) => `notify_inventory_${todayKey}`,
    /** Local notification: health reminder (localStorage, per-record per-day) */
    notifyHealth: (recordId: string, todayKey: string) => `notify_health_${recordId}_${todayKey}`,
    /** Local notification: expired inventory item (localStorage, per-record per-day) */
    notifyExpiredInventory: (recordId: string, todayKey: string) => `notify_expired_inventory_${recordId}_${todayKey}`,
    /** Server push reminder (localStorage, per-cat per-day) */
    serverPushReminder: (todayKey: string, catId: string) => `server_push_reminder_${todayKey}_${catId}`,
} as const
