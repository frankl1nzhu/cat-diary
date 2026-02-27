import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { supabase } from '../lib/supabase'
import { signOut, useSession } from '../lib/auth'
import { useCat } from '../lib/useCat'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import { applyThemePreset, getStoredTheme, type ThemePreset } from '../lib/theme'
import { enablePushNotifications } from '../lib/pushNotifications'
import { savePushSubscription, sendTestPush } from '../lib/pushServer'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import './SettingsPage.css'

export function SettingsPage() {
    const { user } = useSession()
    const { cat, catId } = useCat()
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const pushToast = useToastStore((s) => s.pushToast)
    const [searchParams, setSearchParams] = useSearchParams()

    const [name, setName] = useState('')
    const [breed, setBreed] = useState('')
    const [birthday, setBirthday] = useState('')
    const [adoptedAt, setAdoptedAt] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [themePreset, setThemePreset] = useState<ThemePreset>(getStoredTheme())
    const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)
    const [deleteCatConfirmOpen, setDeleteCatConfirmOpen] = useState(false)
    const [profileLocked, setProfileLocked] = useState(false)
    const [createMode, setCreateMode] = useState(false)
    const [deletingCat, setDeletingCat] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const online = useOnlineStatus()

    // Populate form when cat is loaded via shared hook
    useEffect(() => {
        if (createMode) return
        if (!cat) return
        setName(cat.name)
        setBreed(cat.breed || '')
        setBirthday(cat.birthday || '')
        setAdoptedAt(cat.adopted_at || '')
        setAvatarUrl(cat.avatar_url)
        setProfileLocked(true)
    }, [cat, createMode])

    useEffect(() => {
        const mode = searchParams.get('mode')
        if (mode !== 'new') return

        setCreateMode(true)
        setCurrentCatId(null)
        setName('')
        setBreed('')
        setBirthday('')
        setAdoptedAt('')
        setAvatarUrl(null)
        setProfileLocked(false)

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('mode')
            return next
        }, { replace: true })
    }, [searchParams, setCurrentCatId, setSearchParams])

    // Upload avatar to Supabase Storage
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            pushToast('error', '图片大小不能超过 5MB')
            e.target.value = ''
            return
        }

        setUploading(true)

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `avatar-${Date.now()}.${fileExt}`
            const filePath = `avatars/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('cat-photos')
                .upload(filePath, file, { upsert: true })

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage
                .from('cat-photos')
                .getPublicUrl(filePath)

            setAvatarUrl(urlData.publicUrl)
            pushToast('success', '头像上传成功！')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '头像上传失败，请稍后重试'))
        } finally {
            setUploading(false)
        }
    }

    // Save cat profile
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            pushToast('error', '请输入猫咪名字')
            return
        }

        setSaving(true)

        try {
            const catData = {
                name: name.trim(),
                breed: breed.trim() || null,
                birthday: birthday || null,
                adopted_at: adoptedAt || null,
                avatar_url: avatarUrl,
                created_by: user?.id || '',
            }

            if (catId && !createMode) {
                // Update existing
                const { error } = await supabase
                    .from('cats')
                    .update(catData)
                    .eq('id', catId)
                if (error) throw error
            } else {
                // Insert new
                const { data, error } = await supabase
                    .from('cats')
                    .insert(catData)
                    .select()
                    .single()
                if (error) throw error
                if (data) setCurrentCatId(data.id)
            }

            setProfileLocked(true)
            setCreateMode(false)
            pushToast('success', '档案保存成功！🎉')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '档案保存失败，请稍后重试'))
        } finally {
            setSaving(false)
        }
    }

    const handleSignOut = async () => {
        try {
            await signOut()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '退出登录失败，请稍后重试'))
        }
    }

    const handleEnableNotifications = async () => {
        try {
            const result = await enablePushNotifications()
            if (!result.ok) {
                pushToast('error', result.reason === 'unsupported' ? '当前浏览器不支持系统通知（请使用受支持浏览器）' : '通知权限未开启')
                return
            }

            if (result.subscribed) {
                if (user && result.subscription) {
                    await savePushSubscription(user.id, result.subscription)
                }
                pushToast('success', '通知已开启（含 Web Push 订阅）')
            } else {
                pushToast('info', '通知权限已开启，等待配置 VAPID 公钥后启用 Web Push')
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, '开启通知失败，请稍后重试'))
        }
    }

    const handleTestPush = async () => {
        if (typeof Notification === 'undefined') {
            pushToast('error', '当前浏览器不支持系统通知')
            return
        }
        try {
            await sendTestPush()
            pushToast('success', '测试推送已发送，请稍候查看系统通知')
        } catch (err) {
            const message = getErrorMessage(err, '测试推送发送失败')
            if (message.toLowerCase().includes('non-2xx')) {
                pushToast('error', '测试推送服务暂不可用，请先部署并配置 edge function')
                return
            }
            pushToast('error', message)
        }
    }

    const handleDeleteCat = async () => {
        if (!catId) return
        setDeletingCat(true)
        try {
            const { error } = await supabase.from('cats').delete().eq('id', catId)
            if (error) throw error
            setCurrentCatId(null)
            setDeleteCatConfirmOpen(false)
            setProfileLocked(false)
            setName('')
            setBreed('')
            setBirthday('')
            setAdoptedAt('')
            setAvatarUrl(null)
            pushToast('success', '猫咪档案已删除')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '删除猫咪失败，请稍后重试'))
        } finally {
            setDeletingCat(false)
        }
    }

    const onThemeChange = (preset: ThemePreset) => {
        setThemePreset(preset)
        applyThemePreset(preset)
        pushToast('success', '主题已切换')
    }

    return (
        <div className="settings-page fade-in">
            <div className="page-header p-4">
                <h1 className="text-2xl font-bold">⚙️ 设置</h1>
                <p className="text-secondary text-sm">管理猫咪档案和账号</p>
            </div>

            {/* Cat Profile Editor */}
            <form onSubmit={handleSave}>
                <div className="p-4">
                    <Card variant="default" padding="md">
                        <h2 className="text-lg font-semibold mb-3">😺 猫咪档案</h2>

                        {profileLocked ? (
                            <div className="profile-saved-view">
                                <p className="text-sm text-secondary">档案已保存，基础信息已锁定不可修改。</p>
                                <div className="saved-row">
                                    <span className="text-secondary">头像</span>
                                    {avatarUrl ? <img src={avatarUrl} alt="猫咪头像" className="avatar-preview" /> : <span>—</span>}
                                </div>
                                <div className="saved-row"><span className="text-secondary">名字</span><strong>{name || '—'}</strong></div>
                                <div className="saved-row"><span className="text-secondary">品种</span><strong>{breed || '—'}</strong></div>
                                <div className="saved-row"><span className="text-secondary">生日</span><strong>{birthday || '—'}</strong></div>
                                <div className="saved-row"><span className="text-secondary">领养日</span><strong>{adoptedAt || '—'}</strong></div>
                            </div>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label className="form-label">头像</label>
                                    <label
                                        className="avatar-upload"
                                        htmlFor="cat-avatar"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="猫咪头像" className="avatar-preview" />
                                        ) : (
                                            <span className="avatar-upload-icon">📷</span>
                                        )}
                                        <span className="text-sm text-secondary">
                                            {uploading ? '上传中...' : '点击上传照片'}
                                        </span>
                                        <input
                                            ref={fileInputRef}
                                            id="cat-avatar"
                                            type="file"
                                            accept="image/*"
                                            className="file-input-hidden"
                                            onChange={handleAvatarUpload}
                                        />
                                    </label>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="cat-name">名字 *</label>
                                    <input
                                        id="cat-name"
                                        type="text"
                                        className="form-input"
                                        placeholder="输入猫咪名字"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="cat-breed">品种</label>
                                    <input
                                        id="cat-breed"
                                        type="text"
                                        className="form-input"
                                        placeholder="如：英短、美短、橘猫"
                                        value={breed}
                                        onChange={(e) => setBreed(e.target.value)}
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group flex-1">
                                        <label className="form-label" htmlFor="cat-birthday">生日</label>
                                        <input
                                            id="cat-birthday"
                                            type="date"
                                            className="form-input"
                                            value={birthday}
                                            onChange={(e) => setBirthday(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group flex-1">
                                        <label className="form-label" htmlFor="cat-adopted">领养日</label>
                                        <input
                                            id="cat-adopted"
                                            type="date"
                                            className="form-input"
                                            value={adoptedAt}
                                            onChange={(e) => setAdoptedAt(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Button type="submit" variant="primary" fullWidth disabled={saving || !online}>
                                    {saving ? '保存中...' : createMode ? '新增猫咪' : '保存档案'}
                                </Button>
                            </>
                        )}

                        {catId && (
                            <Button type="button" variant="ghost" fullWidth onClick={() => setDeleteCatConfirmOpen(true)}>
                                删除猫咪
                            </Button>
                        )}
                    </Card>
                </div>
            </form>

            {/* Family Members */}
            <div className="p-4">
                <Card variant="default" padding="md">
                    <h2 className="text-lg font-semibold mb-3">👨‍👩‍👧 家庭成员</h2>
                    <p className="text-secondary text-sm">
                        当前为共享账号模式，两人使用同一账号登录即可实时同步所有数据。
                    </p>
                    {user && (
                        <p className="text-muted text-xs" style={{ marginTop: '8px' }}>
                            当前账号：{user.email}
                        </p>
                    )}
                </Card>
            </div>

            {/* PWA Install Guide */}
            <div className="p-4">
                <Card variant="glass" padding="md">
                    <h2 className="text-lg font-semibold mb-3">📱 安装到桌面</h2>
                    <div className="install-steps">
                        <p className="text-sm text-secondary">
                            <strong>iOS Safari：</strong>点击底部分享按钮 → 选择"添加到主屏幕"
                        </p>
                        <p className="text-sm text-secondary mt-2">
                            <strong>Android Chrome：</strong>点击右上角菜单 → 选择"安装应用"
                        </p>
                    </div>
                </Card>
            </div>

            <div className="p-4">
                <Card variant="default" padding="md">
                    <h2 className="text-lg font-semibold mb-3">🔔 智能提醒</h2>
                    <p className="text-secondary text-sm">开启系统通知后，可接收库存告急和临近驱虫提醒。</p>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={handleEnableNotifications}>开启通知权限</Button>
                        <Button variant="ghost" onClick={handleTestPush}>发送测试推送</Button>
                    </div>
                </Card>
            </div>

            <div className="p-4">
                <Card variant="default" padding="md">
                    <h2 className="text-lg font-semibold mb-3">🎨 主题色</h2>
                    <div className="theme-grid">
                        {([
                            { value: 'pink' as const, label: '粉色（默认）' },
                            { value: 'orange' as const, label: '橘猫主题' },
                            { value: 'blue' as const, label: '蓝猫主题' },
                            { value: 'midnight' as const, label: '暗夜紫主题' },
                        ]).map((item) => (
                            <button
                                key={item.value}
                                className={`theme-option ${themePreset === item.value ? 'theme-option-active' : ''}`}
                                onClick={() => onThemeChange(item.value)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Sign Out */}
            <div className="p-4">
                <Button variant="ghost" fullWidth onClick={() => setSignOutConfirmOpen(true)}>
                    退出登录
                </Button>
            </div>

            <Modal isOpen={signOutConfirmOpen} onClose={() => setSignOutConfirmOpen(false)} title="确认退出登录？">
                <div className="settings-confirm">
                    <p className="text-sm text-secondary">确认要退出当前账号吗？</p>
                    <Button variant="primary" fullWidth onClick={handleSignOut}>
                        确认退出
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={deleteCatConfirmOpen} onClose={() => setDeleteCatConfirmOpen(false)} title="确认删除猫咪？">
                <div className="settings-confirm">
                    <p className="text-sm text-secondary">删除后将清空该猫咪全部记录，此操作不可恢复。</p>
                    <Button variant="primary" fullWidth onClick={handleDeleteCat} disabled={deletingCat}>
                        {deletingCat ? '删除中...' : '确认删除'}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
