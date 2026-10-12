export type SectionId = 'quickActions' | 'mood' | 'latestDiary' | 'weekSummary'

export interface DashboardSectionConfig {
    collapsed: Record<SectionId, boolean>
    hidden: Record<SectionId, boolean>
}

export const DASHBOARD_SECTIONS: { id: SectionId; labelZh: string; labelEn: string }[] = [
    { id: 'quickActions', labelZh: '快捷操作', labelEn: 'Quick Actions' },
    { id: 'mood', labelZh: '今日心情与日历', labelEn: 'Mood & Calendar' },
    { id: 'latestDiary', labelZh: '最新日记', labelEn: 'Latest Diary' },
    { id: 'weekSummary', labelZh: '本周汇总', labelEn: 'Weekly Summary' },
]

export const DEFAULT_SECTION_CONFIG: DashboardSectionConfig = {
    collapsed: {
        quickActions: false,
        mood: false,
        latestDiary: false,
        weekSummary: false,
    },
    hidden: {
        quickActions: false,
        mood: false,
        latestDiary: false,
        weekSummary: false,
    },
}

const STORAGE_KEY = 'cat_diary_dashboard_sections'

export function getDashboardSectionConfig(): DashboardSectionConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return DEFAULT_SECTION_CONFIG
        const parsed = JSON.parse(raw)
        return {
            collapsed: { ...DEFAULT_SECTION_CONFIG.collapsed, ...parsed.collapsed },
            hidden: { ...DEFAULT_SECTION_CONFIG.hidden, ...parsed.hidden },
        }
    } catch {
        return DEFAULT_SECTION_CONFIG
    }
}

export function saveDashboardSectionConfig(config: DashboardSectionConfig): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
        // ignore
    }
}

export function setDashboardSectionCollapsed(sectionId: SectionId, collapsed: boolean): DashboardSectionConfig {
    const current = getDashboardSectionConfig()
    const next: DashboardSectionConfig = {
        ...current,
        collapsed: {
            ...current.collapsed,
            [sectionId]: collapsed,
        },
    }
    saveDashboardSectionConfig(next)
    return next
}

export function setDashboardSectionHidden(sectionId: SectionId, hidden: boolean): DashboardSectionConfig {
    const current = getDashboardSectionConfig()
    const next: DashboardSectionConfig = {
        ...current,
        hidden: {
            ...current.hidden,
            [sectionId]: hidden,
        },
    }
    saveDashboardSectionConfig(next)
    return next
}
