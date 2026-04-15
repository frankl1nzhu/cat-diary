import { memo, useMemo, useState } from 'react'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { differenceInDays } from 'date-fns'
import type { Cat } from '../../types/database.types'
import { useI18n } from '../../lib/i18n'

interface CatProfileCardProps {
    cat: Cat | null
}

export const CatProfileCard = memo(function CatProfileCard({ cat }: CatProfileCardProps) {
    const { language } = useI18n()
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)
    const text = language === 'zh'
        ? {
            previewAvatar: '查看猫咪头像大图',
            addCat: '添加猫咪',
            editProfileHint: '在设置中编辑档案',
            daysAtHome: '来到这个家',
            daysToBirthday: '下次生日',
            avatarTitle: '猫咪头像',
            avatarOf: (name: string) => `${name} 的头像`,
        }
        : {
            previewAvatar: 'Preview cat avatar',
            addCat: 'Add Cat',
            editProfileHint: 'Edit profile in Settings',
            daysAtHome: 'Days at home',
            daysToBirthday: 'Next birthday',
            avatarTitle: 'Cat avatar',
            avatarOf: (name: string) => `${name}'s avatar`,
        }

    const { daysHome, daysToBirthday } = useMemo(() => {
        if (!cat) return { daysHome: null, daysToBirthday: null }
        const now = new Date()

        let daysHome: number | null = null
        if (cat.adopted_at) {
            daysHome = differenceInDays(now, new Date(cat.adopted_at))
        }

        let daysToBirthday: number | null = null
        if (cat.birthday) {
            const bday = new Date(cat.birthday)
            const nextBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
            if (nextBday < now) nextBday.setFullYear(nextBday.getFullYear() + 1)
            daysToBirthday = differenceInDays(nextBday, now)
        }

        return { daysHome, daysToBirthday }
    }, [cat])

    return (
        <>
            <div className="stagger-item">
                <Card variant="accent" padding="lg" className="cat-profile-card">
                    <div className="profile-header">
                        <div className="avatar-placeholder">
                            {cat?.avatar_url ? (
                                <button
                                    type="button"
                                    className="avatar-preview-btn"
                                    onClick={() => setAvatarPreviewOpen(true)}
                                    aria-label={text.previewAvatar}
                                >
                                    <img src={cat.avatar_url} alt={cat.name} className="avatar-img" loading="lazy" />
                                </button>
                            ) : (
                                <span className="avatar-emoji">🐱</span>
                            )}
                        </div>
                        <div className="profile-info">
                            <h1 className="cat-name">{cat?.name || text.addCat}</h1>
                            <p className="cat-breed text-sm">{cat?.breed || text.editProfileHint}</p>
                        </div>
                    </div>
                    <div className="countdown-row">
                        <div className="countdown-item">
                            <span className="countdown-number">{daysHome !== null ? (language === 'zh' ? `${daysHome}天` : `${daysHome}d`) : '—'}</span>
                            <span className="countdown-label">{text.daysAtHome}</span>
                        </div>
                        <div className="countdown-item">
                            <span className="countdown-number">{daysToBirthday !== null ? (language === 'zh' ? `${daysToBirthday}天` : `${daysToBirthday}d`) : '—'}</span>
                            <span className="countdown-label">{text.daysToBirthday}</span>
                        </div>
                    </div>
                </Card>
            </div>

            <Modal isOpen={avatarPreviewOpen} onClose={() => setAvatarPreviewOpen(false)} title={cat?.name ? text.avatarOf(cat.name) : text.avatarTitle}>
                {cat?.avatar_url ? (
                    <img src={cat.avatar_url} alt={cat.name || text.avatarTitle} className="avatar-preview-modal-img" loading="lazy" />
                ) : null}
            </Modal>
        </>
    )
})
