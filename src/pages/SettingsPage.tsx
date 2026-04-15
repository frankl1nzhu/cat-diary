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
import { reloadCatData } from '../stores/useCatStore'
import { getErrorMessage } from '../lib/errorMessage'
import { compressImage } from '../lib/imageCompress'
import { applyThemePreset, getStoredTheme, type ThemePreset } from '../lib/theme'
import { enablePushNotifications, getVapidPublicKey, isStandaloneDisplayMode } from '../lib/pushNotifications'
import { savePushSubscription, sendTestPush, sendCatProfileNotification, sendNewCatNotification, sendFamilyMemberNotification, sendFamilyMemberLeftNotification } from '../lib/pushServer'
import { useFamily } from '../lib/useFamily'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { useI18n } from '../lib/i18n'
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
    const { language } = useI18n()
    const l = useCallback((zh: string, en: string) => (language === 'zh' ? zh : en), [language])
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
    const [, setNotificationHint] = useState('')
    const [isStandaloneMode, setIsStandaloneMode] = useState(false)
    const [dissolveFamilyOpen, setDissolveFamilyOpen] = useState(false)
    const [dissolveStep, setDissolveStep] = useState(1)
    const [dissolveConfirmInput, setDissolveConfirmInput] = useState('')
    const [dissolving, setDissolving] = useState(false)
    const [leaveFamilyOpen, setLeaveFamilyOpen] = useState(false)
    const [leaveStep, setLeaveStep] = useState(1)
    const [leaveConfirmInput, setLeaveConfirmInput] = useState('')
    const [leavingFamily, setLeavingFamily] = useState(false)
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
    const text = language === 'zh'
        ? {
            loading: '加载中...',
            title: '⚙️ 设置',
            subtitle: '管理猫咪档案和账号',
            catProfile: '😺 猫咪档案',
            profileSaved: '已保存档案',
            avatar: '头像',
            name: '名字',
            family: '家庭',
            unassigned: '未分配',
            breed: '品种',
            birthday: '生日',
            adoptedAt: '领养日',
            editProfile: '编辑档案',
            avatarLabel: '头像',
            uploading: '上传中...',
            clickToUpload: '点击上传照片',
            nameRequired: '名字 *',
            namePlaceholder: '输入猫咪名字',
            familyRequired: '家庭 *',
            selectFamily: '请选择家庭',
            noFamily: '暂无家庭，请先创建或加入',
            breedLabel: '品种',
            breedPlaceholder: '如：英短、美短、橘猫',
            birthdayLabel: '生日',
            adoptedLabel: '领养日',
            saving: '保存中...',
            addCat: '新增猫咪',
            saveProfile: '保存档案',
            deleteCat: '删除猫咪',
            familyMgmt: '👨‍👩‍👧 家庭管理',
            currentFamily: '当前家庭：',
            yourRole: '你的角色：',
            roleOwner: '创建者',
            roleAdmin: '管理员',
            roleMember: '成员',
            inviteCode: '邀请码：',
            switchFamily: '切换家庭',
            members: '家庭成员',
            noMembers: '暂无成员数据',
            pendingJoin: '待审核加入申请',
            noPendingJoin: '暂无待审核申请',
            approve: '同意',
            reject: '拒绝',
            removeAdmin: '取消管理员',
            setAdmin: '设为管理员',
            kick: '踢出',
            assignCurrentCat: '将当前猫咪归属到该家庭',
            familySettings: '家庭设置',
        }
        : {
            loading: 'Loading...',
            title: '⚙️ Settings',
            subtitle: 'Manage cat profile and account',
            catProfile: '😺 Cat Profile',
            profileSaved: 'Profile saved',
            avatar: 'Avatar',
            name: 'Name',
            family: 'Family',
            unassigned: 'Unassigned',
            breed: 'Breed',
            birthday: 'Birthday',
            adoptedAt: 'Adoption date',
            editProfile: 'Edit profile',
            avatarLabel: 'Avatar',
            uploading: 'Uploading...',
            clickToUpload: 'Tap to upload photo',
            nameRequired: 'Name *',
            namePlaceholder: 'Enter cat name',
            familyRequired: 'Family *',
            selectFamily: 'Please select a family',
            noFamily: 'No family yet, create or join one first',
            breedLabel: 'Breed',
            breedPlaceholder: 'e.g. British Shorthair, American Shorthair, Tabby',
            birthdayLabel: 'Birthday',
            adoptedLabel: 'Adoption date',
            saving: 'Saving...',
            addCat: 'Add cat',
            saveProfile: 'Save profile',
            deleteCat: 'Delete cat',
            familyMgmt: '👨‍👩‍👧 Family Management',
            currentFamily: 'Current family: ',
            yourRole: 'Your role: ',
            roleOwner: 'Owner',
            roleAdmin: 'Admin',
            roleMember: 'Member',
            inviteCode: 'Invite code: ',
            switchFamily: 'Switch family',
            members: 'Family members',
            noMembers: 'No member data yet',
            pendingJoin: 'Pending join requests',
            noPendingJoin: 'No pending requests',
            approve: 'Approve',
            reject: 'Reject',
            removeAdmin: 'Remove admin',
            setAdmin: 'Set as admin',
            kick: 'Remove',
            assignCurrentCat: 'Assign current cat to this family',
            familySettings: 'Family settings',
        }
    const roleText = myRole === 'owner' ? text.roleOwner : myRole === 'admin' ? text.roleAdmin : text.roleMember

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
                    setNotificationHint(l('Web Push 已启用。', 'Web Push enabled.'))
                } else {
                    setNotificationHint(l('等待配置 VAPID 公钥后启用 Web Push。', 'Waiting for VAPID public key before enabling Web Push.'))
                }
            }).catch(() => {
                setNotificationHint(l('等待配置 VAPID 公钥后启用 Web Push。', 'Waiting for VAPID public key before enabling Web Push.'))
            })
        }
    }, [l, user])

    // Upload avatar to Supabase Storage
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFile = e.target.files?.[0]
        if (!rawFile) return
        if (rawFile.size > 10 * 1024 * 1024) {
            pushToast('error', l('图片大小不能超过 10MB', 'Image size must be less than 10MB'))
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

            pushToast('success', l('头像上传成功！', 'Avatar uploaded successfully!'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('头像上传失败，请稍后重试', 'Avatar upload failed, please try again later')))
        } finally {
            setUploading(false)
        }
    }

    // Save cat profile
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            pushToast('error', l('请输入猫咪名字', 'Please enter a cat name'))
            return
        }
        if (!selectedFamilyId) {
            pushToast('error', l('请选择猫咪所属家庭', 'Please select the cat family'))
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
            pushToast('success', l('档案保存成功！🎉', 'Profile saved successfully! 🎉'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('档案保存失败，请稍后重试', 'Failed to save profile, please try again later')))
        } finally {
            setSaving(false)
        }
    }

    const handleSignOut = async () => {
        try {
            await signOut()
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('退出登录失败，请稍后重试', 'Sign out failed, please try again later')))
        }
    }

    const handleEnableNotifications = async () => {
        try {
            const result = await enablePushNotifications()
            if (!result.ok) {
                if (result.reason === 'ios-add-to-home-screen') {
                    pushToast('error', l('iPhone Safari 需先“添加到主屏幕”后才能开启通知（iOS 16.4+）', 'On iPhone Safari, add to Home Screen first to enable notifications (iOS 16.4+)'))
                    return
                }
                if (result.reason === 'unsupported' || result.reason === 'unsupported-push') {
                    pushToast('error', l('当前浏览器不支持 Web Push 通知', 'Current browser does not support Web Push notifications'))
                    return
                }
                if (result.reason === 'push-subscribe-failed') {
                    pushToast('error', l('Web Push 订阅失败，请稍后重试', 'Web Push subscription failed, please try again later'))
                    return
                }
                pushToast('error', l('通知权限未开启', 'Notification permission is not enabled'))
                return
            }

            setNotificationPermission('granted')

            if (result.subscribed) {
                if (user && result.subscription) {
                    await savePushSubscription(user.id, result.subscription)
                }
                setNotificationHint(l('Web Push 已启用。', 'Web Push enabled.'))
                pushToast('success', l('通知已开启（含 Web Push 订阅）', 'Notifications enabled (including Web Push subscription)'))
            } else {
                const vapidKey = await getVapidPublicKey()
                if (vapidKey) {
                    setNotificationHint(l('通知权限已开启，Web Push 订阅失败，请重试。', 'Notification permission granted, but Web Push subscription failed. Please retry.'))
                    pushToast('error', l('Web Push 订阅失败，请重试', 'Web Push subscription failed, please retry'))
                } else {
                    setNotificationHint(l('等待配置 VAPID 公钥后启用 Web Push。', 'Waiting for VAPID public key before enabling Web Push.'))
                    pushToast('info', l('通知权限已开启，等待配置 VAPID 公钥后启用 Web Push', 'Notification permission granted. Waiting for VAPID public key to enable Web Push'))
                }
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('开启通知失败，请稍后重试', 'Failed to enable notifications, please try again later')))
        }
    }

    const handleTestPush = async () => {
        if (typeof Notification === 'undefined') {
            pushToast('error', l('当前浏览器不支持系统通知', 'Current browser does not support system notifications'))
            return
        }
        try {
            await sendTestPush()
            pushToast('success', l('测试推送已发送，请稍候查看系统通知', 'Test push sent, please check system notifications shortly'))
        } catch (err) {
            const message = getErrorMessage(err, l('测试推送发送失败', 'Failed to send test push'))
            if (message.toLowerCase().includes('non-2xx') && Notification.permission === 'granted') {
                try {
                    new Notification(l('测试通知', 'Test notification'), {
                        body: l('这是一条本地测试通知。', 'This is a local test notification.'),
                    })
                } catch {
                    // ignore and still show success toast fallback
                }
                pushToast('success', l('测试通知已发送', 'Test notification sent'))
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
                sendFamilyMemberNotification(currentFamily.id, target?.requesterEmail || l('新成员', 'new member')).catch(() => { })
                pushToast('success', l('已同意加入申请', 'Join request approved'))
            } else {
                pushToast('success', l('已拒绝加入申请', 'Join request rejected'))
            }

            setPendingJoinRequests((prev) => prev.filter((item) => item.id !== requestId))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('处理申请失败，请稍后重试', 'Failed to process request, please try again later')))
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
            pushToast('success', l('当前猫咪已归属到家庭', 'Current cat assigned to family'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('猫咪归属家庭失败', 'Failed to assign cat to family')))
        }
    }

    const doLeaveFamily = async () => {
        if (!user || !currentFamily) return
        if (myRole === 'owner') {
            pushToast('error', l('家庭创建者不能退出，请先转让所有权或删除家庭', 'Family owner cannot leave. Transfer ownership or dissolve the family first'))
            return
        }
        setLeavingFamily(true)
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

            sendFamilyMemberLeftNotification(currentFamily.id, user.email || l('家庭成员', 'family member')).catch(() => { })

            setActiveFamilyId(null)
            setCurrentFamily(null)
            closeLeaveFamilyModal()
            pushToast('success', l('已退出家庭', 'Left family successfully'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('退出家庭失败，请稍后重试', 'Failed to leave family, please try again later')))
        } finally {
            setLeavingFamily(false)
        }
    }

    const openLeaveFamilyModal = () => {
        setLeaveStep(1)
        setLeaveConfirmInput('')
        setLeaveFamilyOpen(true)
    }

    const closeLeaveFamilyModal = () => {
        setLeaveFamilyOpen(false)
        setLeaveStep(1)
        setLeaveConfirmInput('')
    }

    const handleLeaveFamily = async () => {
        if (!currentFamily || !user) return
        if (leaveStep < 2) {
            setLeaveStep(2)
            return
        }

        const expected = user.email || ''
        if (leaveConfirmInput.trim() !== expected) {
            pushToast('error', l(`请输入当前账号「${expected}」以确认退出`, `Please enter current account "${expected}" to confirm leaving`))
            return
        }

        await doLeaveFamily()
    }

    const handleDissolveFamily = async () => {
        if (!user || !currentFamily || myRole !== 'owner') return
        if (dissolveStep < 2) {
            setDissolveStep(2)
            return
        }
        if (dissolveStep < 3) {
            if (dissolveConfirmInput.trim() !== currentFamily.name) {
                pushToast('error', l('请输入正确的家庭名称以确认', 'Please enter the exact family name to confirm'))
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
            pushToast('success', l('家庭已解散，所有猫咪数据已删除', 'Family dissolved and all cat data deleted'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('解散家庭失败，请稍后重试', 'Failed to dissolve family, please try again later')))
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
            pushToast('success', newRole === 'admin' ? l('已设为管理员', 'Set as admin') : l('已取消管理员', 'Admin role removed'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('角色更新失败', 'Failed to update role')))
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
                pushToast('error', l('请输入正确的成员邮箱以确认', 'Please enter the exact member email to confirm'))
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
            pushToast('success', l(`已将 ${kickTarget.email} 移出家庭`, `${kickTarget.email} has been removed from family`))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('踢出成员失败，请稍后重试', 'Failed to remove member, please try again later')))
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
            pushToast('error', l('请输入正确的猫咪名字以确认删除', 'Please enter the exact cat name to confirm deletion'))
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
            pushToast('success', l('猫咪档案已删除', 'Cat profile deleted'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('删除猫咪失败，请稍后重试', 'Failed to delete cat, please try again later')))
        } finally {
            setDeletingCat(false)
        }
    }

    const onThemeChange = (preset: ThemePreset) => {
        setThemePreset(preset)
        applyThemePreset(preset)
        pushToast('success', l('主题已切换', 'Theme switched'))
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
                        <p className="text-secondary text-sm">{text.loading}</p>
                    </Card>
                </div>
            ) : (
                <>
                    <div className="page-header p-4">
                        <h1 className="text-2xl font-bold">{text.title}</h1>
                        <p className="text-secondary text-sm">{text.subtitle}</p>
                    </div>

                    {/* Cat Profile Editor */}
                    <form onSubmit={handleSave}>
                        <div className="p-4">
                            <Card variant="default" padding="md">
                                <h2 className="text-lg font-semibold mb-3">{text.catProfile}</h2>
                                {profileLocked && !createMode ? (
                                    <div className="profile-saved-view">
                                        <p className="text-sm text-secondary">{text.profileSaved}</p>
                                        <div className="saved-row">
                                            <span className="text-secondary">{text.avatar}</span>
                                            {avatarUrl ? <img src={avatarUrl} alt={l('猫咪头像', 'Cat avatar')} className="avatar-preview" loading="lazy" /> : <span>—</span>}
                                        </div>
                                        <div className="saved-row"><span className="text-secondary">{text.name}</span><strong>{name || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">{text.family}</span><strong>{families.find((f) => f.id === selectedFamilyId)?.name || text.unassigned}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">{text.breed}</span><strong>{breed || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">{text.birthday}</span><strong>{birthday || '—'}</strong></div>
                                        <div className="saved-row"><span className="text-secondary">{text.adoptedAt}</span><strong>{adoptedAt || '—'}</strong></div>
                                        <div className="cat-actions-row">
                                            <Button type="button" variant="secondary" fullWidth onClick={() => setProfileLocked(false)} disabled={myRole !== 'owner' && myRole !== 'admin'}>
                                                {text.editProfile}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">{text.avatarLabel}</label>
                                            <div
                                                className="avatar-upload"
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => fileInputRef.current?.click()}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                                            >
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt={l('猫咪头像', 'Cat avatar')} className="avatar-preview" loading="lazy" />
                                                ) : (
                                                    <span className="avatar-upload-icon">📷</span>
                                                )}
                                                <span className="text-sm text-secondary">
                                                    {uploading ? text.uploading : text.clickToUpload}
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
                                            <label className="form-label" htmlFor="cat-name">{text.nameRequired}</label>
                                            <input
                                                id="cat-name"
                                                type="text"
                                                className="form-input"
                                                placeholder={text.namePlaceholder}
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="cat-family">{text.familyRequired}</label>
                                            <select
                                                id="cat-family"
                                                className="form-input"
                                                value={selectedFamilyId}
                                                onChange={(e) => setSelectedFamilyId(e.target.value)}
                                                required
                                            >
                                                <option value="">{families.length > 0 ? text.selectFamily : text.noFamily}</option>
                                                {families.map((family) => (
                                                    <option key={family.id} value={family.id}>{family.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="cat-breed">{text.breedLabel}</label>
                                            <input
                                                id="cat-breed"
                                                type="text"
                                                className="form-input"
                                                placeholder={text.breedPlaceholder}
                                                value={breed}
                                                onChange={(e) => setBreed(e.target.value)}
                                            />
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group flex-1">
                                                <label className="form-label" htmlFor="cat-birthday">{text.birthdayLabel}</label>
                                                <input
                                                    id="cat-birthday"
                                                    type="date"
                                                    className="form-input"
                                                    value={birthday}
                                                    onChange={(e) => setBirthday(e.target.value)}
                                                />
                                            </div>
                                            <div className="form-group flex-1">
                                                <label className="form-label" htmlFor="cat-adopted">{text.adoptedLabel}</label>
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
                                                {saving ? text.saving : createMode ? text.addCat : text.saveProfile}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                fullWidth
                                                onClick={openDeleteCatModal}
                                                disabled={!catId || createMode || (myRole !== 'owner' && myRole !== 'admin')}
                                            >
                                                {text.deleteCat}
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
                            <h2 className="text-lg font-semibold mb-3">{text.familyMgmt}</h2>
                            {currentFamily ? (
                                <>
                                    <p className="text-secondary text-sm">{text.currentFamily}{currentFamily.name}</p>
                                    <p className="text-muted text-xs" style={{ marginTop: '4px' }}>
                                        {text.yourRole}{roleText}
                                    </p>
                                    <p className="text-muted text-xs" style={{ marginTop: '4px' }}>{text.inviteCode}{currentFamily.invite_code}</p>
                                    {families.length > 1 && (
                                        <div className="form-group" style={{ marginTop: '12px' }}>
                                            <label className="form-label">{text.switchFamily}</label>
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
                                            <h3 className="text-sm font-semibold" style={{ marginBottom: '8px' }}>{text.members}</h3>
                                            {membersLoading ? (
                                                <p className="text-muted text-xs">{text.loading}</p>
                                            ) : familyMembers.length === 0 ? (
                                                <p className="text-muted text-xs">{text.noMembers}</p>
                                            ) : (
                                                <div className="member-list">
                                                    {familyMembers.map((member) => (
                                                        <div key={member.id} className="member-row">
                                                            <div className="member-info">
                                                                <span className="member-email text-sm">{member.email}</span>
                                                                <span className={`member-role-badge role-${member.role}`}>
                                                                    {member.role === 'owner' ? text.roleOwner : member.role === 'admin' ? text.roleAdmin : text.roleMember}
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
                                                                        {roleSaving === member.id ? '...' : member.role === 'admin' ? text.removeAdmin : text.setAdmin}
                                                                    </Button>
                                                                    <Button
                                                                        variant="danger"
                                                                        size="sm"
                                                                        onClick={() => openKickModal(member)}
                                                                    >
                                                                        {text.kick}
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
                                            <h3 className="text-sm font-semibold" style={{ marginBottom: '8px' }}>{text.pendingJoin}</h3>
                                            {joinReqLoading ? (
                                                <p className="text-muted text-xs">{text.loading}</p>
                                            ) : pendingJoinRequests.length === 0 ? (
                                                <p className="text-muted text-xs">{text.noPendingJoin}</p>
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
                                                                    {text.approve}
                                                                </Button>
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    onClick={() => handleReviewJoinRequest(req.id, false)}
                                                                    disabled={reviewingReqId === req.id}
                                                                >
                                                                    {text.reject}
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
                                            <Button variant="ghost" onClick={handleAssignCurrentCatToFamily}>{text.assignCurrentCat}</Button>
                                        </div>
                                    )}
                                    <div style={{ marginTop: '12px' }}>
                                        <Button variant="secondary" onClick={openFamilySettingsModal}>{text.familySettings}</Button>
                                    </div>
                                </>
                            ) : (
                                <div className="family-actions">
                                    <p className="text-secondary text-sm">{l('你当前还没有加入家庭。', 'You are not in a family yet.')}</p>
                                    <Button variant="secondary" onClick={openFamilySettingsModal}>{l('家庭设置', 'Family settings')}</Button>
                                </div>
                            )}
                            {user && (
                                <p className="text-muted text-xs" style={{ marginTop: '8px' }}>
                                    {l('当前账号：', 'Current account: ')}{user.email}
                                </p>
                            )}
                        </Card>
                    </div>

                    {!isStandaloneMode && (
                        <div className="p-4">
                            <Card variant="glass" padding="md">
                                <h2 className="text-lg font-semibold mb-3">{l('📱 安装到桌面', '📱 Install to Home Screen')}</h2>
                                <div className="install-steps">
                                    <p className="text-sm text-secondary">
                                        <strong>{l('iOS Safari：', 'iOS Safari: ')}</strong>{l('点击底部分享按钮 → 选择"添加到主屏幕"', 'Tap Share at the bottom -> choose "Add to Home Screen"')}
                                    </p>
                                    <p className="text-sm text-secondary mt-2">
                                        <strong>{l('Android Chrome：', 'Android Chrome: ')}</strong>{l('点击右上角菜单 → 选择"安装应用"', 'Tap the top-right menu -> choose "Install app"')}
                                    </p>
                                </div>
                            </Card>
                        </div>
                    )}

                    {notificationPermission !== 'granted' && (
                        <div className="p-4">
                            <Card variant="default" padding="md">
                                <h2 className="text-lg font-semibold mb-3">{l('🔔 智能提醒', '🔔 Smart Alerts')}</h2>
                                <p className="text-secondary text-sm">{l('开启系统通知后，可接收库存告急和临近驱虫提醒。', 'Enable system notifications to receive low-stock and deworming alerts.')}</p>
                                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <Button variant="secondary" onClick={handleEnableNotifications}>
                                        {l('开启通知权限', 'Enable notifications')}
                                    </Button>
                                    <Button variant="ghost" onClick={handleTestPush}>{l('发送测试推送', 'Send test push')}</Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    <div className="p-4">
                        <Card variant="default" padding="md">
                            <h2 className="text-lg font-semibold mb-3">{l('🎨 主题色', '🎨 Theme')}</h2>
                            <div className="theme-grid">
                                {([
                                    { value: 'pink' as const, label: l('粉色（默认）', 'Pink (Default)') },
                                    { value: 'orange' as const, label: l('橘猫主题', 'Orange Cat') },
                                    { value: 'blue' as const, label: l('蓝猫主题', 'Blue Cat') },
                                    { value: 'midnight' as const, label: l('暗夜紫主题', 'Midnight Purple') },
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
                            {l('退出登录', 'Sign out')}
                        </Button>
                    </div>

                    <Modal isOpen={signOutConfirmOpen} onClose={() => setSignOutConfirmOpen(false)} title={l('确认退出登录？', 'Confirm sign out?')}>
                        <div className="settings-confirm">
                            <p className="text-sm text-secondary">{l('确认要退出当前账号吗？', 'Do you want to sign out of the current account?')}</p>
                            <Button variant="primary" fullWidth onClick={handleSignOut}>
                                {l('确认退出', 'Confirm sign out')}
                            </Button>
                        </div>
                    </Modal>

                    <Modal isOpen={deleteCatConfirmOpen} onClose={closeDeleteCatModal} title={l('确认删除猫咪？', 'Confirm delete cat?')}>
                        <div className="settings-confirm">
                            {deleteStep === 1 ? (
                                <>
                                    <p className="text-sm text-secondary">{l('删除后将清空该猫咪全部记录，此操作不可恢复。', 'Deleting will clear all records of this cat. This cannot be undone.')}</p>
                                    <Button variant="primary" fullWidth onClick={handleDeleteCat} disabled={deletingCat}>
                                        {l('下一步', 'Next')}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-secondary">{l(`请输入猫咪名字「${cat?.name || ''}」以确认删除。`, `Please enter cat name "${cat?.name || ''}" to confirm deletion.`)}</p>
                                    <input
                                        className="form-input"
                                        value={deleteConfirmInput}
                                        onChange={(event) => setDeleteConfirmInput(event.target.value)}
                                        placeholder={l('输入猫咪名字确认', 'Enter cat name to confirm')}
                                    />
                                    <Button variant="primary" fullWidth onClick={handleDeleteCat} disabled={deletingCat}>
                                        {deletingCat ? l('删除中...', 'Deleting...') : l('确认删除', 'Confirm delete')}
                                    </Button>
                                </>
                            )}
                        </div>
                    </Modal>

                    <Modal isOpen={dissolveFamilyOpen} onClose={closeDissolveFamilyModal} title={l('⚠️ 解散家庭', '⚠️ Dissolve Family')}>
                        <div className="settings-confirm">
                            {dissolveStep === 1 && (
                                <>
                                    <p className="text-sm text-secondary">
                                        {l(`解散家庭「${currentFamily?.name}」将`, `Dissolving family "${currentFamily?.name}" will `)}<strong className="text-danger">{l('永久删除', 'permanently delete')}</strong>{l('该家庭下的所有猫咪和全部记录数据。此操作不可恢复。', ' all cats and records in this family. This cannot be undone.')}
                                    </p>
                                    <p className="text-sm text-secondary">{l('所有家庭成员将被移出。', 'All family members will be removed.')}</p>
                                    <Button variant="danger" fullWidth onClick={handleDissolveFamily}>
                                        {l('我了解，继续', 'I understand, continue')}
                                    </Button>
                                </>
                            )}
                            {dissolveStep === 2 && (
                                <>
                                    <p className="text-sm text-secondary">
                                        {l(`请输入家庭名称「${currentFamily?.name}」以确认解散。`, `Please enter family name "${currentFamily?.name}" to confirm.`)}
                                    </p>
                                    <input
                                        className="form-input"
                                        value={dissolveConfirmInput}
                                        onChange={(e) => setDissolveConfirmInput(e.target.value)}
                                        placeholder={l('输入家庭名称确认', 'Enter family name to confirm')}
                                    />
                                    <Button variant="danger" fullWidth onClick={handleDissolveFamily}>
                                        {l('确认名称', 'Confirm name')}
                                    </Button>
                                </>
                            )}
                            {dissolveStep === 3 && (
                                <>
                                    <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                                        {l('最终确认：点击后将立即解散家庭并删除所有数据！', 'Final confirmation: clicking will dissolve family and delete all data immediately!')}
                                    </p>
                                    <Button variant="danger" fullWidth onClick={handleDissolveFamily} disabled={dissolving}>
                                        {dissolving ? l('解散中...', 'Dissolving...') : l('确认解散家庭', 'Confirm dissolve family')}
                                    </Button>
                                </>
                            )}
                        </div>
                    </Modal>

                    <Modal isOpen={familySettingsOpen} onClose={() => setFamilySettingsOpen(false)} title={l('家庭设置', 'Family settings')}>
                        <div className="settings-confirm">
                            {currentFamily && myRole !== 'owner' && (
                                <Button variant="secondary" fullWidth onClick={openLeaveFamilyModal}>
                                    {l('退出家庭', 'Leave family')}
                                </Button>
                            )}
                            {currentFamily && myRole === 'owner' && (
                                <Button variant="danger" fullWidth onClick={openDissolveFamilyModal}>
                                    {l('解散家庭', 'Dissolve family')}
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
                                        {currentFamily ? l('创建新家庭', 'Create new family') : l('创建家庭', 'Create family')}
                                    </Button>
                                ) : (
                                    <>
                                        <label className="form-label" htmlFor="family-settings-create">{currentFamily ? l('创建新家庭', 'Create new family') : l('创建家庭', 'Create family')}</label>
                                        <input
                                            id="family-settings-create"
                                            className="form-input"
                                            placeholder={l('输入家庭名称', 'Enter family name')}
                                            value={familyName}
                                            onChange={(e) => setFamilyName(e.target.value)}
                                        />
                                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                            <Button variant="secondary" onClick={handleCreateFamily} disabled={isFamilySaving || !online}>
                                                {isFamilySaving ? l('处理中...', 'Processing...') : l('确认创建', 'Confirm create')}
                                            </Button>
                                            <Button variant="ghost" onClick={() => { setShowCreateFamilyInput(false); setFamilyName('') }} disabled={isFamilySaving}>
                                                {l('取消', 'Cancel')}
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
                                        {currentFamily ? l('加入其他家庭', 'Join another family') : l('加入家庭', 'Join family')}
                                    </Button>
                                ) : (
                                    <>
                                        <label className="form-label" htmlFor="family-settings-join">{currentFamily ? l('加入其他家庭', 'Join another family') : l('加入家庭', 'Join family')}</label>
                                        <input
                                            id="family-settings-join"
                                            className="form-input"
                                            placeholder={l('输入邀请码', 'Enter invite code')}
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        />
                                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                            <Button variant="secondary" onClick={handleJoinFamily} disabled={isFamilySaving || !online}>
                                                {isFamilySaving ? l('处理中...', 'Processing...') : l('确认加入', 'Confirm join')}
                                            </Button>
                                            <Button variant="ghost" onClick={() => { setShowJoinFamilyInput(false); setJoinCode('') }} disabled={isFamilySaving}>
                                                {l('取消', 'Cancel')}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </Modal>

                    <Modal isOpen={leaveFamilyOpen} onClose={closeLeaveFamilyModal} title={l('确认退出家庭？', 'Confirm leave family?')}>
                        <div className="settings-confirm">
                            {leaveStep === 1 ? (
                                <>
                                    <p className="text-sm text-secondary">{l(`退出后你将不再属于家庭「${currentFamily?.name}」，并失去该家庭协作权限。`, `After leaving, you will no longer belong to family "${currentFamily?.name}" and lose collaboration permissions.`)}</p>
                                    <Button variant="secondary" fullWidth onClick={handleLeaveFamily} disabled={leavingFamily}>
                                        {l('我了解，继续', 'I understand, continue')}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-secondary">{l(`请输入当前账号邮箱「${user?.email || ''}」以确认退出。`, `Please enter current account email "${user?.email || ''}" to confirm.`)}</p>
                                    <input
                                        className="form-input"
                                        value={leaveConfirmInput}
                                        onChange={(event) => setLeaveConfirmInput(event.target.value)}
                                        placeholder={l('输入当前账号邮箱', 'Enter current account email')}
                                    />
                                    <Button variant="secondary" fullWidth onClick={handleLeaveFamily} disabled={leavingFamily}>
                                        {leavingFamily ? l('处理中...', 'Processing...') : l('确认退出家庭', 'Confirm leave family')}
                                    </Button>
                                </>
                            )}
                        </div>
                    </Modal>

                    <Modal isOpen={Boolean(kickTarget)} onClose={closeKickModal} title={l('⚠️ 踢出家庭成员', '⚠️ Remove Family Member')}>
                        <div className="settings-confirm">
                            {kickStep === 1 && (
                                <>
                                    <p className="text-sm text-secondary">
                                        {l('确认要将 ', 'Confirm removing ')}<strong>{kickTarget?.email}</strong>{l(` 从家庭「${currentFamily?.name}」中移除吗？`, ` from family "${currentFamily?.name}"?`)}
                                    </p>
                                    <p className="text-sm text-secondary">{l('该成员创建的猫咪将留在该家庭。', 'Cats created by this member will remain in this family.')}</p>
                                    <Button variant="danger" fullWidth onClick={handleKickMember}>
                                        {l('我了解，继续', 'I understand, continue')}
                                    </Button>
                                </>
                            )}
                            {kickStep === 2 && (
                                <>
                                    <p className="text-sm text-secondary">
                                        {l(`请输入该成员邮箱「${kickTarget?.email}」以确认踢出。`, `Please enter member email "${kickTarget?.email}" to confirm.`)}
                                    </p>
                                    <input
                                        className="form-input"
                                        value={kickConfirmInput}
                                        onChange={(e) => setKickConfirmInput(e.target.value)}
                                        placeholder={l('输入成员邮箱确认', 'Enter member email to confirm')}
                                    />
                                    <Button variant="danger" fullWidth onClick={handleKickMember}>
                                        {l('确认邮箱', 'Confirm email')}
                                    </Button>
                                </>
                            )}
                            {kickStep === 3 && (
                                <>
                                    <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                                        {l('最终确认：点击后将立即移除该成员！', 'Final confirmation: clicking will remove this member immediately!')}
                                    </p>
                                    <Button variant="danger" fullWidth onClick={handleKickMember} disabled={kicking}>
                                        {kicking ? l('移除中...', 'Removing...') : l('确认踢出', 'Confirm remove')}
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
