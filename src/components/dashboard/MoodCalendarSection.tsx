import { useState, useTransition, useOptimistic } from 'react'
import { Card } from '../ui/Card'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { useToastStore } from '../../stores/useToastStore'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { getErrorMessage } from '../../lib/errorMessage'
import { lightHaptic } from '../../lib/haptics'
import { format, getDate } from 'date-fns'
import type { MoodType, Cat } from '../../types/database.types'

interface MoodCalendarSectionProps {
    cat: Cat | null
    today: string
    todayMood: MoodType | null
    monthMoodMap: Record<string, MoodType>
    monthDays: Date[]
    onMoodSaved: (mood: MoodType) => void
}

const moodColorMap: Record<MoodType, string> = {
    '😸': 'mood-day-happy',
    '😾': 'mood-day-angry',
    '😴': 'mood-day-sleepy',
}

export function MoodCalendarSection({
    cat,
    today,
    todayMood,
    monthMoodMap,
    monthDays,
    onMoodSaved,
}: MoodCalendarSectionProps) {
    const { user } = useSession()
    const pushToast = useToastStore((s) => s.pushToast)
    const online = useOnlineStatus()
    const [moodEditing, setMoodEditing] = useState(false)
    const [moodSaving, setMoodSaving] = useState(false)
    const [optimisticMood, setOptimisticMood] = useOptimistic(todayMood)
    const [, startTransition] = useTransition()

    const handleMoodPick = async (mood: MoodType) => {
        if (!cat || !user || moodSaving) return
        setMoodSaving(true)

        startTransition(async () => {
            setOptimisticMood(mood)
            try {
                await supabase
                    .from('mood_logs')
                    .upsert(
                        { cat_id: cat.id, mood, date: today, created_by: user.id },
                        { onConflict: 'cat_id,date' },
                    )
                onMoodSaved(mood)
                setMoodEditing(false)
                lightHaptic()
                pushToast('success', '心情已记录')
            } catch (err) {
                pushToast('error', getErrorMessage(err, '心情记录失败，请稍后重试'))
            } finally {
                setMoodSaving(false)
            }
        })
    }

    const moveMoodSelection = (direction: 1 | -1) => {
        const options: MoodType[] = ['😸', '😾', '😴']
        const currentIndex = options.findIndex((item) => item === (optimisticMood || '😸'))
        const nextIndex = (currentIndex + direction + options.length) % options.length
        void handleMoodPick(options[nextIndex])
    }

    return (
        <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
            <Card variant="glass" padding="md" aria-label="记录心情">
                <div className="mood-head-row">
                    <div className="bento-label">今日心情</div>
                    <div className="mood-status-row">
                        <span className="text-sm text-secondary">
                            {optimisticMood ? `已记录：${optimisticMood}` : '未记录'}
                        </span>
                        {optimisticMood && !moodEditing && (
                            <button type="button" className="mood-edit-btn" onClick={() => setMoodEditing(true)}>
                                修改
                            </button>
                        )}
                    </div>
                </div>
                {(!optimisticMood || moodEditing) && (
                    <div
                        className="mood-picker"
                        role="radiogroup"
                        aria-label="心情选择"
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                                event.preventDefault()
                                moveMoodSelection(1)
                            }
                            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                                event.preventDefault()
                                moveMoodSelection(-1)
                            }
                        }}
                    >
                        {(['😸', '😾', '😴'] as MoodType[]).map((mood) => (
                            <button
                                key={mood}
                                className={`mood-btn ${optimisticMood === mood ? 'mood-btn-active' : ''}`}
                                onClick={() => handleMoodPick(mood)}
                                disabled={moodSaving || !online}
                                aria-label={mood}
                                role="radio"
                                aria-checked={optimisticMood === mood}
                            >
                                {mood}
                            </button>
                        ))}
                    </div>
                )}
                <div className="mood-calendar">
                    {monthDays.map((day) => {
                        const key = format(day, 'yyyy-MM-dd')
                        const mood = monthMoodMap[key]
                        return (
                            <div
                                key={key}
                                className={`mood-day ${mood ? moodColorMap[mood] : ''}`}
                                title={`${format(day, 'MM/dd')} ${mood || '无记录'}`}
                            >
                                {getDate(day)}
                            </div>
                        )
                    })}
                </div>
            </Card>
        </div>
    )
}
