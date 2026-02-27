import { useState, useEffect, useRef, useCallback } from 'react'
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
import type { Family } from '../types/database.types'
import './SettingsPage.css'

export function SettingsPage() {
    const { user } = useSession()
    const { cat, catId, loading: catLoading } = useCat()
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
    const [deleteStep, setDeleteStep] = useState(1)
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
    const [profileLocked, setProfileLocked] = useState(false)
    const [createMode, setCreateMode] = useState(false)
    const [deletingCat, setDeletingCat] = useState(false)
    const [currentFamily, setCurrentFamily] = useState<Family | null>(null)
    const [familyOptions, setFamilyOptions] = useState<Family[]>([])
    const [selectedFamilyId, setSelectedFamilyId] = useState('')
    const [familyName, setFamilyName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [familySaving, setFamilySaving] = useState(false)
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
    const [notificationHint, setNotificationHint] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const online = useOnlineStatus()

    const loadFamily = useCallback(async () => {
        if (!user) {
            setCurrentFamily(null)
            return
        }

        const { data: memberships } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

        const familyIds = (memberships || []).map((item) => item.family_id)
        if (familyIds.length === 0) {
            setCurrentFamily(null)
            setFamilyOptions([])
            return
        }

        const { data: families } = await supabase
            .from('families')
            .select('*')
            .in('id', familyIds)
            .order('created_at', { ascending: true })
            .limit(1)

        const options = families || []
        setFamilyOptions(options)
        setCurrentFamily(options[0] || null)
    }, [user])

    // Populate form when cat is loaded via shared hook
    useEffect(() => {
        if (createMode) return
        if (catLoading) return
        if (!cat) return
        setName(cat.name)
        setBreed(cat.breed || '')
        setBirthday(cat.birthday || '')
        setAdoptedAt(cat.adopted_at || '')
        setAvatarUrl(cat.avatar_url)
        setSelectedFamilyId(cat.family_id || '')
        setProfileLocked(true)
    }, [cat, catLoading, createMode])

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
        setSelectedFamilyId(currentFamily?.id || '')
        setProfileLocked(false)

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('mode')
            return next
        }, { replace: true })
    }, [currentFamily?.id, searchParams, setCurrentCatId, setSearchParams])

    useEffect(() => {
        void loadFamily()
    }, [loadFamily])

    useEffect(() => {
        if (!selectedFamilyId && currentFamily?.id) {
            setSelectedFamilyId(currentFamily.id)
        }
    }, [currentFamily, selectedFamilyId])

    useEffect(() => {
        if (typeof Notification === 'undefined') return
        setNotificationPermission(Notification.permission)
        if (Notification.permission === 'granted') {
            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
            if (vapidKey) {
                setNotificationHint('Web Push 已启用。')
            } else {
                setNotificationHint('等待配置 VAPID 公钥后启用 Web Push。')
            }
        }
    }, [])

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
        if (createMode && !selectedFamilyId) {
            pushToast('error', '新增猫咪前请先选择家庭')
            return
        }

        setSaving(true)

        try {
            const targetFamilyId = selectedFamilyId || null
            const catData = {
                name: name.trim(),
                breed: breed.trim() || null,
                birthday: birthday || null,
                adopted_at: adoptedAt || null,
                avatar_url: avatarUrl,
                family_id: targetFamilyId,
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

            setCreateMode(false)
            setProfileLocked(true)
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
                if (result.reason === 'ios-add-to-home-screen') {
                    pushToast('error', 'iPhone Safari 需先“添加到主屏幕”后才能开启通知（iOS 16.4+）')
                    return
                }
                if (result.reason === 'unsupported' || result.reason === 'unsupported-push') {
                    pushToast('error', '当前浏览器不支持 Web Push 通知')
                    return
                }
                pushToast('error', '通知权限未开启')
                return
            }

            setNotificationPermission('granted')

            if (result.subscribed) {
                if (user && result.subscription) {
                    await savePushSubscription(user.id, result.subscription)
                }
                setNotificationHint('Web Push 已启用。')
                pushToast('success', '通知已开启（含 Web Push 订阅）')
            } else {
                const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
                if (vapidKey) {
                    setNotificationHint('通知权限已开启，Web Push 订阅失败，请重试。')
                    pushToast('error', 'Web Push 订阅失败，请重试')
                } else {
                    setNotificationHint('等待配置 VAPID 公钥后启用 Web Push。')
                    pushToast('info', '通知权限已开启，等待配置 VAPID 公钥后启用 Web Push')
                }
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
            if (message.toLowerCase().includes('non-2xx') && Notification.permission === 'granted') {
                try {
                    new Notification('喵记测试通知', {
                        body: '这是一条本地测试通知。',
                    })
                } catch {
                    // ignore and still show success toast fallback
                }
                pushToast('success', '测试通知已发送')
                return
            }
            pushToast('error', message)
        }
    }

    const generateInviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

    const handleCreateFamily = async () => {
        if (!user) return
        const nameValue = familyName.trim()
        if (!nameValue) {
            pushToast('error', '请输入家庭名称')
            return
        }

        setFamilySaving(true)
        try {
            const inviteCode = generateInviteCode()
            const { data: newFamily, error: createErr } = await supabase
                .from('families')
                .insert({
                    name: nameValue,
                    invite_code: inviteCode,
                    created_by: user.id,
                })
                .select('*')
                .single()

            if (createErr || !newFamily) throw createErr || new Error('家庭创建失败')

            const { error: memberErr } = await supabase
                .from('family_members')
                .insert({
                    family_id: newFamily.id,
                    user_id: user.id,
                    role: 'owner',
                })
            if (memberErr) throw memberErr

            if (catId) {
                await supabase.from('cats').update({ family_id: newFamily.id }).eq('id', catId)
            }

            setCurrentFamily(newFamily)
            setFamilyOptions((prev) => [newFamily, ...prev.filter((item) => item.id !== newFamily.id)])
            setSelectedFamilyId(newFamily.id)
            setFamilyName('')
            pushToast('success', `家庭已创建，邀请码：${newFamily.invite_code}`)
        } catch (err) {
            pushToast('error', getErrorMessage(err, '创建家庭失败，请稍后重试'))
        } finally {
            setFamilySaving(false)
        }
    }

    const handleJoinFamily = async () => {
        if (!user) return
        const code = joinCode.trim().toUpperCase()
        if (!code) {
            pushToast('error', '请输入邀请码')
            return
        }

        setFamilySaving(true)
        try {
            const { data: family, error: findErr } = await supabase
                .from('families')
                .select('*')
                .eq('invite_code', code)
                .single()

            if (findErr || !family) throw findErr || new Error('家庭不存在')

            const { error: joinErr } = await supabase
                .from('family_members')
                .upsert({
                    family_id: family.id,
                    user_id: user.id,
                    role: 'member',
                }, { onConflict: 'family_id,user_id' })
            if (joinErr) throw joinErr

            if (catId) {
                await supabase.from('cats').update({ family_id: family.id }).eq('id', catId)
            }

            setCurrentFamily(family)
            setFamilyOptions((prev) => [family, ...prev.filter((item) => item.id !== family.id)])
            setSelectedFamilyId(family.id)
            setJoinCode('')
            pushToast('success', `已加入家庭：${family.name}`)
        } catch (err) {
            pushToast('error', getErrorMessage(err, '加入家庭失败，请检查邀请码'))
        } finally {
            setFamilySaving(false)
        }
    }

    const handleAssignCurrentCatToFamily = async () => {
        if (!catId || !currentFamily) return
        try {
            const { error } = await supabase
                .from('cats')
                .update({ family_id: currentFamily.id })
                .eq('id', catId)
            if (error) throw error
            setSelectedFamilyId(currentFamily.id)
            pushToast('success', '当前猫咪已归属到家庭')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '猫咪归属家庭失败'))
        }
    }

    const handleLeaveFamily = async () => {
        if (!user || !currentFamily) return
        try {
            const { error: memberError } = await supabase
                .from('family_members')
                .delete()
                .eq('family_id', currentFamily.id)
                .eq('user_id', user.id)
            if (memberError) throw memberError

            if (catId && cat?.family_id === currentFamily.id) {
                await supabase.from('cats').update({ family_id: null }).eq('id', catId)
                setSelectedFamilyId('')
            }

            await loadFamily()
            pushToast('success', '已退出家庭')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '退出家庭失败，请稍后重试'))
        }
    }

    const handleDeleteCat = async () => {
        if (!catId) return
        if (deleteStep < 2) {
            setDeleteStep(2)
            return
        }
        if (deleteConfirmInput.trim() !== (cat?.name || '')) {
            pushToast('error', '请输入正确的猫咪名字以确认删除')
            return
        }
        setDeletingCat(true)
        try {
            const { error } = await supabase.from('cats').delete().eq('id', catId)
            if (error) throw error
            setCurrentCatId(null)
            closeDeleteCatModal()
            setName('')
            setBreed('')
            setBirthday('')
            setAdoptedAt('')
            setAvatarUrl(null)
            setSelectedFamilyId(currentFamily?.id || '')
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

    const openDeleteCatModal = () => {
        setDeleteStep(1)
        setDeleteConfirmInput('')
        setDeleteCatConfirmOpen(true)
    }

    const closeDeleteCatModal = () => {
        setDeleteCatConfirmOpen(false)
        setDeleteStep(1)
        setDeleteConfirmInput('')
    }

    return (
        <div className="settings-page fade-in">
            {catLoading && !createMode ? (
                <div className="p-4">
                    <Card variant="default" padding="md">
                        <p className="text-secondary text-sm">加载中...</p>
                    </Card>
                </div>
            ) : (
                <>
                    <div className="page-header p-4">
                        <h1 className="text-2xl font-bold">⚙️ 设置</h1>
                        <p className="text-secondary text-sm">管理猫咪档案和账号</p>
                    </div>

                    {/* Cat Profile Editor */}
                    <form onSubmit={handleSave}>
                        <div className="p-4">
                            <Card variant="default" padding="md">
                                <h2 className="text-lg font-semibold mb-3">😺 猫咪档案</h2>
                                {profileLocked && !createMode ? (
                                    <div className="profile-saved-view">
                                        <p className="text-sm text-secondary">已保存档案</p>
                                        <div className="saved-row">
                                            <span className="text-secondary">头像</span>
                                            {avatarUrl ? <img src={avatarUrl} alt="猫咪头像" className="avatar-preview" /> : <span>—</span>}
                                        </div>
                                        <div className="saved-row"><span className="text-secondary">名字</span><strong>{name || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">家庭</span><strong>{familyOptions.find((f) => f.id === selectedFamilyId)?.name || '未分配'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">品种</span><strong>{breed || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">生日</span><strong>{birthday || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">领养日</span><strong>{adoptedAt || '—'}</strong></div>
                                        <div className="cat-actions-row">
                                            <Button type="button" variant="ghost" fullWidth onClick={() => setProfileLocked(false)}>
                                                编辑档案
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                fullWidth
                                                onClick={openDeleteCatModal}
                                                disabled={!catId}
                                            >
                                                删除猫咪
                                            </Button>
                                        </div>
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
                                            <label className="form-label" htmlFor="cat-family">家庭 {createMode ? '*' : ''}</label>
                                            <select
                                                id="cat-family"
                                                className="form-input"
                                                value={selectedFamilyId}
                                                onChange={(e) => setSelectedFamilyId(e.target.value)}
                                                required={createMode}
                                            >
                                                <option value="">{familyOptions.length > 0 ? '请选择家庭' : '暂无家庭，请先创建或加入'}</option>
                                                {familyOptions.map((family) => (
                                                    <option key={family.id} value={family.id}>{family.name}</option>
                                                ))}
                                            </select>
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
                                        <div className="cat-actions-row">
                                            <Button type="submit" variant="primary" fullWidth disabled={saving || !online}>
                                                {saving ? '保存中...' : createMode ? '新增猫咪' : '保存档案'}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                fullWidth
                                                onClick={openDeleteCatModal}
                                                disabled={!catId || createMode}
                                            >
                                                删除猫咪
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Card>
                        </div>
                    </form>

                    {/* Family Members */}
                    <div className="p-4">
                        <Card variant="default" padding="md">
                            <h2 className="text-lg font-semibold mb-3">👨‍👩‍👧 家庭成员</h2>
                            {currentFamily ? (
                                <>
                                    <p className="text-secondary text-sm">当前家庭：{currentFamily.name}</p>
                                    <p className="text-muted text-xs" style={{ marginTop: '8px' }}>邀请码：{currentFamily.invite_code}</p>
                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <Button variant="ghost" onClick={handleLeaveFamily}>退出家庭</Button>
                                    </div>
                                    {cat && cat.family_id !== currentFamily.id && (
                                        <div style={{ marginTop: '12px' }}>
                                            <Button variant="ghost" onClick={handleAssignCurrentCatToFamily}>将当前猫咪归属到该家庭</Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="family-actions">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="family-name">创建家庭</label>
                                        <input
                                            id="family-name"
                                            className="form-input"
                                            placeholder="输入家庭名称"
                                            value={familyName}
                                            onChange={(e) => setFamilyName(e.target.value)}
                                        />
                                        <Button variant="secondary" onClick={handleCreateFamily} disabled={familySaving || !online}>
                                            {familySaving ? '处理中...' : '创建家庭'}
                                        </Button>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="family-invite-code">加入家庭</label>
                                        <input
                                            id="family-invite-code"
                                            className="form-input"
                                            placeholder="输入邀请码"
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        />
                                        <Button variant="ghost" onClick={handleJoinFamily} disabled={familySaving || !online}>
                                            {familySaving ? '处理中...' : '加入家庭'}
                                        </Button>
                                    </div>
                                </div>
                            )}
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
                            {notificationPermission === 'granted' && (
                                <p className="text-secondary text-sm" style={{ marginTop: '6px' }}>
                                    {notificationHint || '等待配置 VAPID 公钥后启用 Web Push。'}
                                </p>
                            )}
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <Button variant="secondary" onClick={handleEnableNotifications}>
                                    {notificationPermission === 'granted' ? '已开启通知权限' : '开启通知权限'}
                                </Button>
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

                    <Modal isOpen={deleteCatConfirmOpen} onClose={closeDeleteCatModal} title="确认删除猫咪？">
                        <div className="settings-confirm">
                            {deleteStep === 1 ? (
                                <>
                                    <p className="text-sm text-secondary">删除后将清空该猫咪全部记录，此操作不可恢复。</p>
                                    <Button variant="primary" fullWidth onClick={handleDeleteCat} disabled={deletingCat}>
                                        下一步
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-secondary">请输入猫咪名字「{cat?.name || ''}」以确认删除。</p>
                                    <input
                                        className="form-input"
                                        value={deleteConfirmInput}
                                        onChange={(event) => setDeleteConfirmInput(event.target.value)}
                                        placeholder="输入猫咪名字确认"
                                    />
                                    <Button variant="primary" fullWidth onClick={handleDeleteCat} disabled={deletingCat}>
                                        {deletingCat ? '删除中...' : '确认删除'}
                                    </Button>
                                </>
                            )}
                        </div>
                    </Modal>
                </>
            )}
        </div>
    )
}
