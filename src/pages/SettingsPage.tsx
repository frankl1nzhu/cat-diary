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
import { reloadCatData } from '../stores/useCatStore'
import { getErrorMessage } from '../lib/errorMessage'
import { compressImage } from '../lib/imageCompress'
import { applyThemePreset, getStoredTheme, type ThemePreset } from '../lib/theme'
import { enablePushNotifications, getVapidPublicKey, isStandaloneDisplayMode } from '../lib/pushNotifications'
import { savePushSubscription, sendTestPush, sendCatProfileNotification, sendNewCatNotification, sendFamilyMemberNotification, sendFamilyMemberLeftNotification } from '../lib/pushServer'
import { useFamily } from '../lib/useFamily'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import type { Family, FamilyMemberWithEmail } from '../types/database.types'
import './SettingsPage.css'

type FamilyJoinRequest = {
    id: string
    family_id: string
    user_id: string
    status: 'pending' | 'approved' | 'rejected'
    requested_at: string
    reviewed_at: string | null
    reviewed_by: string | null
}

type FamilyJoinRequestWithProfile = FamilyJoinRequest & {
    requesterEmail?: string
}

export function SettingsPage() {
    const { user } = useSession()
    const { cat, catId, families, activeFamilyId, setActiveFamilyId, myRole, loading: catLoading } = useCat()
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
    const [selectedFamilyId, setSelectedFamilyId] = useState('')
    const [familyName, setFamilyName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [showCreateFamilyInput, setShowCreateFamilyInput] = useState(false)
    const [showJoinFamilyInput, setShowJoinFamilyInput] = useState(false)
    const { createFamily, joinFamily, familySaving: isFamilySaving } = useFamily()
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
    const [notificationHint, setNotificationHint] = useState('')
    const [isStandaloneMode, setIsStandaloneMode] = useState(false)
    const [dissolveFamilyOpen, setDissolveFamilyOpen] = useState(false)
    const [dissolveStep, setDissolveStep] = useState(1)
    const [dissolveConfirmInput, setDissolveConfirmInput] = useState('')
    const [dissolving, setDissolving] = useState(false)
    const [familyMembers, setFamilyMembers] = useState<FamilyMemberWithEmail[]>([])
    const [membersLoading, setMembersLoading] = useState(false)
    const [roleSaving, setRoleSaving] = useState<string | null>(null)
    const [kickTarget, setKickTarget] = useState<FamilyMemberWithEmail | null>(null)
    const [kickStep, setKickStep] = useState(1)
    const [kickConfirmInput, setKickConfirmInput] = useState('')
    const [kicking, setKicking] = useState(false)
    const [familySettingsOpen, setFamilySettingsOpen] = useState(false)
    const [pendingJoinRequests, setPendingJoinRequests] = useState<FamilyJoinRequestWithProfile[]>([])
    const [joinReqLoading, setJoinReqLoading] = useState(false)
    const [reviewingReqId, setReviewingReqId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const online = useOnlineStatus()

    // Derive currentFamily from useCat's families + activeFamilyId
    useEffect(() => {
        const fam = families.find((f) => f.id === activeFamilyId) || families[0] || null
        setCurrentFamily(fam)
    }, [families, activeFamilyId])

    // Load family members when currentFamily changes
    useEffect(() => {
        if (!currentFamily) {
            setFamilyMembers([])
            return
        }
        if (myRole !== 'owner' && myRole !== 'admin') {
            setFamilyMembers([])
            return
        }
        let cancelled = false
        setMembersLoading(true)
        supabase
            .rpc('get_family_members_with_email', { target_family_id: currentFamily.id })
            .then(({ data, error }) => {
                if (cancelled) return
                if (error) {
                    console.error('Error loading family members:', error)
                    setFamilyMembers([])
                } else {
                    setFamilyMembers((data || []) as FamilyMemberWithEmail[])
                }
                setMembersLoading(false)
            })
        return () => { cancelled = true }
    }, [currentFamily, myRole])

    // Load pending join requests (owner/admin only)
    useEffect(() => {
        if (!currentFamily || (myRole !== 'owner' && myRole !== 'admin')) {
            setPendingJoinRequests([])
            return
        }
        let cancelled = false
        setJoinReqLoading(true)

            ; (async () => {
                const { data, error } = await supabase
                    .from('family_join_requests')
                    .select('*')
                    .eq('family_id', currentFamily.id)
                    .eq('status', 'pending')
                    .order('requested_at', { ascending: true })

                if (cancelled) return
                if (error || !data) {
                    setPendingJoinRequests([])
                    setJoinReqLoading(false)
                    return
                }

                const userIds = Array.from(new Set(data.map((item) => item.user_id)))
                const { data: users } = await supabase
                    .from('profiles')
                    .select('id,email')
                    .in('id', userIds)

                const emailMap = new Map((users || []).map((u) => [u.id, u.email]))
                const merged = data.map((row) => ({
                    ...(row as FamilyJoinRequest),
                    requesterEmail: emailMap.get(row.user_id) || row.user_id,
                }))

                setPendingJoinRequests(merged)
                setJoinReqLoading(false)
            })()

        return () => { cancelled = true }
    }, [currentFamily, myRole])

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
        setSelectedFamilyId(activeFamilyId || '')
        setProfileLocked(false)

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('mode')
            return next
        }, { replace: true })
    }, [activeFamilyId, searchParams, setCurrentCatId, setSearchParams])

    useEffect(() => {
        if (!selectedFamilyId && activeFamilyId) {
            setSelectedFamilyId(activeFamilyId)
        }
    }, [activeFamilyId, selectedFamilyId])

    useEffect(() => {
        setIsStandaloneMode(isStandaloneDisplayMode())
    }, [])

    useEffect(() => {
        if (typeof Notification === 'undefined') return
        setNotificationPermission(Notification.permission)

        if (Notification.permission === 'granted') {
            getVapidPublicKey().then((vapidKey) => {
                if (vapidKey) {
                    enablePushNotifications().then(async (result) => {
                        if (result.ok && 'subscribed' in result && result.subscribed && 'subscription' in result && result.subscription && user) {
                            await savePushSubscription(user.id, result.subscription).catch(() => { })
                        }
                    }).catch(() => { })
                    setNotificationHint('Web Push 已启用。')
                } else {
                    setNotificationHint('等待配置 VAPID 公钥后启用 Web Push。')
                }
            }).catch(() => {
                setNotificationHint('等待配置 VAPID 公钥后启用 Web Push。')
            })
        }
    }, [user])

    // Upload avatar to Supabase Storage
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFile = e.target.files?.[0]
        if (!rawFile) return
        if (rawFile.size > 10 * 1024 * 1024) {
            pushToast('error', '图片大小不能超过 10MB')
            e.target.value = ''
            return
        }

        setUploading(true)

        try {
            const file = await compressImage(rawFile)
            const fileName = `avatar-${Date.now()}.jpg`
            const filePath = `avatars/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('cat-photos')
                .upload(filePath, file, { upsert: true })

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage
                .from('cat-photos')
                .getPublicUrl(filePath)

            const newUrl = urlData.publicUrl
            setAvatarUrl(newUrl)

            // Auto-save avatar to DB for existing cats
            if (catId && !createMode) {
                try {
                    await supabase.from('cats').update({ avatar_url: newUrl }).eq('id', catId)
                    reloadCatData()
                } catch { /* save with form later */ }
            }

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
        if (!selectedFamilyId) {
            pushToast('error', '请选择猫咪所属家庭')
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
                sendCatProfileNotification(catId, name.trim()).catch(() => { })
            } else {
                // Insert new
                const { data, error } = await supabase
                    .from('cats')
                    .insert(catData)
                    .select()
                    .single()
                if (error) throw error
                if (data) {
                    setCurrentCatId(data.id)
                    sendNewCatNotification(data.id, name.trim()).catch(() => { })
                }
            }

            setCreateMode(false)
            setProfileLocked(true)
            reloadCatData()
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
                if (result.reason === 'push-subscribe-failed') {
                    pushToast('error', 'Web Push 订阅失败，请稍后重试')
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
                const vapidKey = await getVapidPublicKey()
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
                    new Notification('测试通知', {
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

    const handleCreateFamily = async () => {
        await createFamily(familyName, {
            assignCat: true,
            onSuccess: (newFamily) => {
                setCurrentFamily(newFamily as Family)
                setSelectedFamilyId(newFamily.id)
                setFamilyName('')
                setShowCreateFamilyInput(false)
            },
        })
    }

    const handleJoinFamily = async () => {
        await joinFamily(joinCode, {
            assignCat: false,
            onSuccess: (family) => {
                setCurrentFamily(family as Family)
                setJoinCode('')
                setShowJoinFamilyInput(false)
            },
        })
    }

    const handleReviewJoinRequest = async (requestId: string, approve: boolean) => {
        if (!currentFamily) return
        setReviewingReqId(requestId)
        try {
            const target = pendingJoinRequests.find((item) => item.id === requestId)
            const { error } = await supabase.rpc('approve_family_join_request', {
                req_id: requestId,
                approve,
            })
            if (error) throw error

            if (approve) {
                sendFamilyMemberNotification(currentFamily.id, target?.requesterEmail || '新成员').catch(() => { })
                pushToast('success', '已同意加入申请')
            } else {
                pushToast('success', '已拒绝加入申请')
            }

            setPendingJoinRequests((prev) => prev.filter((item) => item.id !== requestId))
        } catch (err) {
            pushToast('error', getErrorMessage(err, '处理申请失败，请稍后重试'))
        } finally {
            setReviewingReqId(null)
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
            reloadCatData()
            pushToast('success', '当前猫咪已归属到家庭')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '猫咪归属家庭失败'))
        }
    }

    const handleLeaveFamily = async () => {
        if (!user || !currentFamily) return
        if (myRole === 'owner') {
            pushToast('error', '家庭创建者不能退出，请先转让所有权或删除家庭')
            return
        }
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

            sendFamilyMemberLeftNotification(currentFamily.id, user.email || '家庭成员').catch(() => { })

            setActiveFamilyId(null)
            setCurrentFamily(null)
            pushToast('success', '已退出家庭')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '退出家庭失败，请稍后重试'))
        }
    }

    const handleDissolveFamily = async () => {
        if (!user || !currentFamily || myRole !== 'owner') return
        if (dissolveStep < 2) {
            setDissolveStep(2)
            return
        }
        if (dissolveStep < 3) {
            if (dissolveConfirmInput.trim() !== currentFamily.name) {
                pushToast('error', '请输入正确的家庭名称以确认')
                return
            }
            setDissolveStep(3)
            return
        }
        setDissolving(true)
        try {
            const { error } = await supabase.rpc('dissolve_family', { target_family_id: currentFamily.id })
            if (error) throw error
            setActiveFamilyId(null)
            setCurrentFamily(null)
            setCurrentCatId(null)
            closeDissolveFamilyModal()
            pushToast('success', '家庭已解散，所有猫咪数据已删除')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '解散家庭失败，请稍后重试'))
        } finally {
            setDissolving(false)
        }
    }

    const openDissolveFamilyModal = () => {
        setDissolveStep(1)
        setDissolveConfirmInput('')
        setDissolveFamilyOpen(true)
    }

    const closeDissolveFamilyModal = () => {
        setDissolveFamilyOpen(false)
        setDissolveStep(1)
        setDissolveConfirmInput('')
    }

    const handleToggleAdmin = async (memberId: string, memberUserId: string, currentRole: string) => {
        if (!currentFamily || myRole !== 'owner') return
        if (memberUserId === user?.id) return
        const newRole = currentRole === 'admin' ? 'member' : 'admin'
        setRoleSaving(memberId)
        try {
            const { error } = await supabase
                .from('family_members')
                .update({ role: newRole })
                .eq('id', memberId)
            if (error) throw error
            setFamilyMembers((prev) =>
                prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m)
            )
            pushToast('success', newRole === 'admin' ? '已设为管理员' : '已取消管理员')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '角色更新失败'))
        } finally {
            setRoleSaving(null)
        }
    }

    const openKickModal = (member: FamilyMemberWithEmail) => {
        setKickTarget(member)
        setKickStep(1)
        setKickConfirmInput('')
    }

    const closeKickModal = () => {
        setKickTarget(null)
        setKickStep(1)
        setKickConfirmInput('')
    }

    const handleKickMember = async () => {
        if (!kickTarget || !currentFamily) return
        if (kickStep < 2) {
            setKickStep(2)
            return
        }
        if (kickStep < 3) {
            if (kickConfirmInput.trim() !== kickTarget.email) {
                pushToast('error', '请输入正确的成员邮箱以确认')
                return
            }
            setKickStep(3)
            return
        }
        setKicking(true)
        try {
            // Remove member from family
            const { error } = await supabase
                .from('family_members')
                .delete()
                .eq('family_id', currentFamily.id)
                .eq('user_id', kickTarget.user_id)
            if (error) throw error

            // Unassign their cats from this family
            await supabase
                .from('cats')
                .update({ family_id: null })
                .eq('family_id', currentFamily.id)
                .eq('created_by', kickTarget.user_id)

            setFamilyMembers((prev) => prev.filter((m) => m.id !== kickTarget.id))
            closeKickModal()
            pushToast('success', `已将 ${kickTarget.email} 移出家庭`)
        } catch (err) {
            pushToast('error', getErrorMessage(err, '踢出成员失败，请稍后重试'))
        } finally {
            setKicking(false)
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
            reloadCatData()
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

    const openFamilySettingsModal = () => {
        setShowCreateFamilyInput(false)
        setShowJoinFamilyInput(false)
        setFamilySettingsOpen(true)
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
                                            {avatarUrl ? <img src={avatarUrl} alt="猫咪头像" className="avatar-preview" loading="lazy" /> : <span>—</span>}
                                        </div>
                                        <div className="saved-row"><span className="text-secondary">名字</span><strong>{name || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">家庭</span><strong>{families.find((f) => f.id === selectedFamilyId)?.name || '未分配'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">品种</span><strong>{breed || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">生日</span><strong>{birthday || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">领养日</span><strong>{adoptedAt || '—'}</strong></div>
                                        <div className="cat-actions-row">
                                            <Button type="button" variant="secondary" fullWidth onClick={() => setProfileLocked(false)} disabled={myRole !== 'owner' && myRole !== 'admin'}>
                                                编辑档案
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">头像</label>
                                            <div
                                                className="avatar-upload"
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => fileInputRef.current?.click()}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                                            >
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt="猫咪头像" className="avatar-preview" loading="lazy" />
                                                ) : (
                                                    <span className="avatar-upload-icon">📷</span>
                                                )}
                                                <span className="text-sm text-secondary">
                                                    {uploading ? '上传中...' : '点击上传照片'}
                                                </span>
                                            </div>
                                            <input
                                                ref={fileInputRef}
                                                id="cat-avatar"
                                                type="file"
                                                accept="image/*"
                                                className="file-input-hidden"
                                                onChange={handleAvatarUpload}
                                            />
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
                                            <label className="form-label" htmlFor="cat-family">家庭 *</label>
                                            <select
                                                id="cat-family"
                                                className="form-input"
                                                value={selectedFamilyId}
                                                onChange={(e) => setSelectedFamilyId(e.target.value)}
                                                required
                                            >
                                                <option value="">{families.length > 0 ? '请选择家庭' : '暂无家庭，请先创建或加入'}</option>
                                                {families.map((family) => (
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
                                                variant="secondary"
                                                fullWidth
                                                onClick={openDeleteCatModal}
                                                disabled={!catId || createMode || (myRole !== 'owner' && myRole !== 'admin')}
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
                            <h2 className="text-lg font-semibold mb-3">👨‍👩‍👧 家庭管理</h2>
                            {currentFamily ? (
                                <>
                                    <p className="text-secondary text-sm">当前家庭：{currentFamily.name}</p>
                                    <p className="text-muted text-xs" style={{ marginTop: '4px' }}>
                                        你的角色：{myRole === 'owner' ? '创建者' : myRole === 'admin' ? '管理员' : '成员'}
                                    </p>
                                    <p className="text-muted text-xs" style={{ marginTop: '4px' }}>邀请码：{currentFamily.invite_code}</p>
                                    {families.length > 1 && (
                                        <div className="form-group" style={{ marginTop: '12px' }}>
                                            <label className="form-label">切换家庭</label>
                                            <select
                                                className="form-input"
                                                value={activeFamilyId || ''}
                                                onChange={(e) => {
                                                    setActiveFamilyId(e.target.value || null)
                                                    setCurrentCatId(null)
                                                }}
                                            >
                                                {families.map((f) => (
                                                    <option key={f.id} value={f.id}>{f.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {/* Member list for owner/admin */}
                                    {(myRole === 'owner' || myRole === 'admin') && (
                                        <div className="member-list-section">
                                            <h3 className="text-sm font-semibold" style={{ marginBottom: '8px' }}>家庭成员</h3>
                                            {membersLoading ? (
                                                <p className="text-muted text-xs">加载中...</p>
                                            ) : familyMembers.length === 0 ? (
                                                <p className="text-muted text-xs">暂无成员数据</p>
                                            ) : (
                                                <div className="member-list">
                                                    {familyMembers.map((member) => (
                                                        <div key={member.id} className="member-row">
                                                            <div className="member-info">
                                                                <span className="member-email text-sm">{member.email}</span>
                                                                <span className={`member-role-badge role-${member.role}`}>
                                                                    {member.role === 'owner' ? '创建者' : member.role === 'admin' ? '管理员' : '成员'}
                                                                </span>
                                                            </div>
                                                            {myRole === 'owner' && member.user_id !== user?.id && (
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleToggleAdmin(member.id, member.user_id, member.role)}
                                                                        disabled={roleSaving === member.id}
                                                                    >
                                                                        {roleSaving === member.id ? '...' : member.role === 'admin' ? '取消管理员' : '设为管理员'}
                                                                    </Button>
                                                                    <Button
                                                                        variant="danger"
                                                                        size="sm"
                                                                        onClick={() => openKickModal(member)}
                                                                    >
                                                                        踢出
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {(myRole === 'owner' || myRole === 'admin') && (
                                        <div className="member-list-section" style={{ marginTop: '12px' }}>
                                            <h3 className="text-sm font-semibold" style={{ marginBottom: '8px' }}>待审核加入申请</h3>
                                            {joinReqLoading ? (
                                                <p className="text-muted text-xs">加载中...</p>
                                            ) : pendingJoinRequests.length === 0 ? (
                                                <p className="text-muted text-xs">暂无待审核申请</p>
                                            ) : (
                                                <div className="member-list">
                                                    {pendingJoinRequests.map((req) => (
                                                        <div key={req.id} className="member-row">
                                                            <div className="member-info">
                                                                <span className="member-email text-sm">{req.requesterEmail || req.user_id}</span>
                                                                <span className="text-muted text-xs">{new Date(req.requested_at).toLocaleString()}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() => handleReviewJoinRequest(req.id, true)}
                                                                    disabled={reviewingReqId === req.id}
                                                                >
                                                                    同意
                                                                </Button>
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    onClick={() => handleReviewJoinRequest(req.id, false)}
                                                                    disabled={reviewingReqId === req.id}
                                                                >
                                                                    拒绝
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {cat && cat.family_id !== currentFamily.id && (
                                        <div style={{ marginTop: '12px' }}>
                                            <Button variant="ghost" onClick={handleAssignCurrentCatToFamily}>将当前猫咪归属到该家庭</Button>
                                        </div>
                                    )}
                                    <div style={{ marginTop: '12px' }}>
                                        <Button variant="secondary" onClick={openFamilySettingsModal}>家庭设置</Button>
                                    </div>
                                </>
                            ) : (
                                <div className="family-actions">
                                    <p className="text-secondary text-sm">你当前还没有加入家庭。</p>
                                    <Button variant="secondary" onClick={openFamilySettingsModal}>家庭设置</Button>
                                </div>
                            )}
                            {user && (
                                <p className="text-muted text-xs" style={{ marginTop: '8px' }}>
                                    当前账号：{user.email}
                                </p>
                            )}
                        </Card>
                    </div>

                    {!isStandaloneMode && (
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
                    )}

                    {notificationPermission !== 'granted' && (
                        <div className="p-4">
                            <Card variant="default" padding="md">
                                <h2 className="text-lg font-semibold mb-3">🔔 智能提醒</h2>
                                <p className="text-secondary text-sm">开启系统通知后，可接收库存告急和临近驱虫提醒。</p>
                                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <Button variant="secondary" onClick={handleEnableNotifications}>
                                        开启通知权限
                                    </Button>
                                    <Button variant="ghost" onClick={handleTestPush}>发送测试推送</Button>
                                </div>
                            </Card>
                        </div>
                    )}

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

                    <Modal isOpen={dissolveFamilyOpen} onClose={closeDissolveFamilyModal} title="⚠️ 解散家庭">
                        <div className="settings-confirm">
                            {dissolveStep === 1 && (
                                <>
                                    <p className="text-sm text-secondary">
                                        解散家庭「{currentFamily?.name}」将<strong className="text-danger">永久删除</strong>该家庭下的所有猫咪和全部记录数据。此操作不可恢复。
                                    </p>
                                    <p className="text-sm text-secondary">所有家庭成员将被移出。</p>
                                    <Button variant="danger" fullWidth onClick={handleDissolveFamily}>
                                        我了解，继续
                                    </Button>
                                </>
                            )}
                            {dissolveStep === 2 && (
                                <>
                                    <p className="text-sm text-secondary">
                                        请输入家庭名称「{currentFamily?.name}」以确认解散。
                                    </p>
                                    <input
                                        className="form-input"
                                        value={dissolveConfirmInput}
                                        onChange={(e) => setDissolveConfirmInput(e.target.value)}
                                        placeholder="输入家庭名称确认"
                                    />
                                    <Button variant="danger" fullWidth onClick={handleDissolveFamily}>
                                        确认名称
                                    </Button>
                                </>
                            )}
                            {dissolveStep === 3 && (
                                <>
                                    <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                                        最终确认：点击后将立即解散家庭并删除所有数据！
                                    </p>
                                    <Button variant="danger" fullWidth onClick={handleDissolveFamily} disabled={dissolving}>
                                        {dissolving ? '解散中...' : '确认解散家庭'}
                                    </Button>
                                </>
                            )}
                        </div>
                    </Modal>

                    <Modal isOpen={familySettingsOpen} onClose={() => setFamilySettingsOpen(false)} title="家庭设置">
                        <div className="settings-confirm">
                            {currentFamily && myRole !== 'owner' && (
                                <Button variant="secondary" fullWidth onClick={handleLeaveFamily}>
                                    退出家庭
                                </Button>
                            )}
                            {currentFamily && myRole === 'owner' && (
                                <Button variant="danger" fullWidth onClick={openDissolveFamilyModal}>
                                    解散家庭
                                </Button>
                            )}

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                {!showCreateFamilyInput ? (
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        onClick={() => {
                                            setShowCreateFamilyInput(true)
                                            setShowJoinFamilyInput(false)
                                        }}
                                        disabled={isFamilySaving || !online}
                                    >
                                        {currentFamily ? '创建新家庭' : '创建家庭'}
                                    </Button>
                                ) : (
                                    <>
                                        <label className="form-label" htmlFor="family-settings-create">{currentFamily ? '创建新家庭' : '创建家庭'}</label>
                                        <input
                                            id="family-settings-create"
                                            className="form-input"
                                            placeholder="输入家庭名称"
                                            value={familyName}
                                            onChange={(e) => setFamilyName(e.target.value)}
                                        />
                                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                            <Button variant="secondary" onClick={handleCreateFamily} disabled={isFamilySaving || !online}>
                                                {isFamilySaving ? '处理中...' : '确认创建'}
                                            </Button>
                                            <Button variant="ghost" onClick={() => { setShowCreateFamilyInput(false); setFamilyName('') }} disabled={isFamilySaving}>
                                                取消
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                {!showJoinFamilyInput ? (
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        onClick={() => {
                                            setShowJoinFamilyInput(true)
                                            setShowCreateFamilyInput(false)
                                        }}
                                        disabled={isFamilySaving || !online}
                                    >
                                        {currentFamily ? '加入其他家庭' : '加入家庭'}
                                    </Button>
                                ) : (
                                    <>
                                        <label className="form-label" htmlFor="family-settings-join">{currentFamily ? '加入其他家庭' : '加入家庭'}</label>
                                        <input
                                            id="family-settings-join"
                                            className="form-input"
                                            placeholder="输入邀请码"
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        />
                                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                            <Button variant="secondary" onClick={handleJoinFamily} disabled={isFamilySaving || !online}>
                                                {isFamilySaving ? '处理中...' : '确认加入'}
                                            </Button>
                                            <Button variant="ghost" onClick={() => { setShowJoinFamilyInput(false); setJoinCode('') }} disabled={isFamilySaving}>
                                                取消
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </Modal>

                    <Modal isOpen={Boolean(kickTarget)} onClose={closeKickModal} title="⚠️ 踢出家庭成员">
                        <div className="settings-confirm">
                            {kickStep === 1 && (
                                <>
                                    <p className="text-sm text-secondary">
                                        确认要将 <strong>{kickTarget?.email}</strong> 从家庭「{currentFamily?.name}」中移除吗？
                                    </p>
                                    <p className="text-sm text-secondary">该成员创建的猫咪将留在该家庭。</p>
                                    <Button variant="danger" fullWidth onClick={handleKickMember}>
                                        我了解，继续
                                    </Button>
                                </>
                            )}
                            {kickStep === 2 && (
                                <>
                                    <p className="text-sm text-secondary">
                                        请输入该成员邮箱「{kickTarget?.email}」以确认踢出。
                                    </p>
                                    <input
                                        className="form-input"
                                        value={kickConfirmInput}
                                        onChange={(e) => setKickConfirmInput(e.target.value)}
                                        placeholder="输入成员邮箱确认"
                                    />
                                    <Button variant="danger" fullWidth onClick={handleKickMember}>
                                        确认邮箱
                                    </Button>
                                </>
                            )}
                            {kickStep === 3 && (
                                <>
                                    <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                                        最终确认：点击后将立即移除该成员！
                                    </p>
                                    <Button variant="danger" fullWidth onClick={handleKickMember} disabled={kicking}>
                                        {kicking ? '移除中...' : '确认踢出'}
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
