import { useMemo } from 'react'
import { Card } from '../ui/Card'
import { useI18n } from '../../lib/i18n'

export type TimelineFilterType = 'all' | 'diary' | 'poop' | 'weight' | 'feed'

export interface TimelineFilterBarProps {
    keyword: string
    onKeywordChange: (val: string) => void
    filterType: TimelineFilterType
    onFilterTypeChange: (val: TimelineFilterType) => void
    dateStart: string
    onDateStartChange: (val: string) => void
    dateEnd: string
    onDateEndChange: (val: string) => void
    onClearDateFilter: () => void
}

export function TimelineFilterBar({
    keyword,
    onKeywordChange,
    filterType,
    onFilterTypeChange,
    dateStart,
    onDateStartChange,
    dateEnd,
    onDateEndChange,
    onClearDateFilter,
}: TimelineFilterBarProps) {
    const { language } = useI18n()

    const text = useMemo(() => language === 'zh'
        ? {
            searchPlaceholder: '搜索记录关键字',
            searchAria: '搜索记录',
            all: '全部',
            diaryType: '📝 日记',
            poopType: '💩 便便',
            weightType: '⚖️ 体重',
            feedType: '🍽️ 喂食',
            filterAria: '筛选记录类型',
            startDateAria: '开始日期',
            endDateAria: '结束日期',
            to: '至',
        }
        : {
            searchPlaceholder: 'Search records',
            searchAria: 'Search records',
            all: 'All',
            diaryType: '📝 Diary',
            poopType: '💩 Poop',
            weightType: '⚖️ Weight',
            feedType: '🍽️ Feeding',
            filterAria: 'Filter record type',
            startDateAria: 'Start date',
            endDateAria: 'End date',
            to: 'to',
        }, [language])

    return (
        <Card variant="default" padding="md" className="log-filter-card">
            <input
                type="search"
                className="form-input"
                placeholder={text.searchPlaceholder}
                value={keyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                aria-label={text.searchAria}
            />
            <select
                className="form-input"
                value={filterType}
                onChange={(event) => onFilterTypeChange(event.target.value as TimelineFilterType)}
                aria-label={text.filterAria}
            >
                <option value="all">{text.all}</option>
                <option value="diary">{text.diaryType}</option>
                <option value="poop">{text.poopType}</option>
                <option value="weight">{text.weightType}</option>
                <option value="feed">{text.feedType}</option>
            </select>
            <div className="timeline-date-row">
                <input
                    type="date"
                    className="form-input"
                    value={dateStart}
                    onChange={(event) => onDateStartChange(event.target.value)}
                    aria-label={text.startDateAria}
                />
                <span className="text-secondary text-sm">{text.to}</span>
                <input
                    type="date"
                    className="form-input"
                    value={dateEnd}
                    onChange={(event) => onDateEndChange(event.target.value)}
                    min={dateStart || undefined}
                    aria-label={text.endDateAria}
                />
                <button type="button" className="timeline-date-reset" onClick={onClearDateFilter}>
                    {text.all}
                </button>
            </div>
        </Card>
    )
}
