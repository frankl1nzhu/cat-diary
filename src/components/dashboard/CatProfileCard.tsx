import { memo, useMemo, useState } from 'react'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { differenceInDays } from 'date-fns'
import type { Cat } from '../../types/database.types'

interface CatProfileCardProps {
    cat: Cat | null
}

export const CatProfileCard = memo(function CatProfileCard({ cat }: CatProfileCardProps) {
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)

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
                                    aria-label="查看猫咪头像大图"
                                >
                                    <img src={cat.avatar_url} alt={cat.name} className="avatar-img" loading="lazy" />
                                </button>
                            ) : (
                                <span className="avatar-emoji">🐱</span>
                            )}
                        </div>
                        <div className="profile-info">
                            <h1 className="cat-name">{cat?.name || '添加猫咪'}</h1>
                            <p className="cat-breed text-sm">{cat?.breed || '在设置中编辑档案'}</p>
                        </div>
                    </div>
                    <div className="countdown-row">
                        <div className="countdown-item">
                            <span className="countdown-number">{daysHome !== null ? `${daysHome}天` : '—'}</span>
                            <span className="countdown-label">来到这个家</span>
                        </div>
                        <div className="countdown-item">
                            <span className="countdown-number">{daysToBirthday !== null ? `${daysToBirthday}天` : '—'}</span>
                            <span className="countdown-label">下次生日</span>
                        </div>
                    </div>
                </Card>
            </div>

            <Modal isOpen={avatarPreviewOpen} onClose={() => setAvatarPreviewOpen(false)} title={cat?.name ? `${cat.name} 的头像` : '猫咪头像'}>
                {cat?.avatar_url ? (
                    <img src={cat.avatar_url} alt={cat.name || '猫咪头像'} className="avatar-preview-modal-img" loading="lazy" />
                ) : null}
            </Modal>
        </>
    )
})
