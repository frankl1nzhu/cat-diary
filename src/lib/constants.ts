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
    snack: '🍬 加餐',
}

/** Pre-defined diary tags. */
export const DIARY_TAGS = ['睡觉', '干饭', '捣乱', '便便', '玩耍', '撒娇'] as const

/** Check if a poop record indicates abnormal health. */
export function isAbnormalPoop(bristolType: BristolType | string, color: PoopColor | string): boolean {
    return Number(bristolType) >= 6 || ['red', 'black', 'white'].includes(color)
}
