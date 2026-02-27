import { useState, useEffect, useRef } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { signOut, useSession } from '../lib/auth'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import './SettingsPage.css'

export function SettingsPage() {
    const { user } = useSession()
    const currentCatId = useAppStore((s) => s.currentCatId)
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const pushToast = useToastStore((s) => s.pushToast)

    const [name, setName] = useState('')
    const [breed, setBreed] = useState('')
    const [birthday, setBirthday] = useState('')
    const [adoptedAt, setAdoptedAt] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load existing cat profile
    useEffect(() => {
        async function loadCat() {
            const { data, error } = await supabase
                .from('cats')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(1)
                .single()

            if (data && !error) {
                setCurrentCatId(data.id)
                setName(data.name)
                setBreed(data.breed || '')
                setBirthday(data.birthday || '')
                setAdoptedAt(data.adopted_at || '')
                setAvatarUrl(data.avatar_url)
            }
        }
        loadCat()
    }, [setCurrentCatId])

    // Upload avatar to Supabase Storage
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        setMessage(null)

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
            setMessage({ type: 'success', text: '头像上传成功！' })
        } catch (err) {
            pushToast('error', getErrorMessage(err, '头像上传失败，请稍后重试'))
            setMessage({ type: 'error', text: '上传失败，请重试' })
        } finally {
            setUploading(false)
        }
    }

    // Save cat profile
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setMessage({ type: 'error', text: '请输入猫咪名字' })
            return
        }

        setSaving(true)
        setMessage(null)

        try {
            const catData = {
                name: name.trim(),
                breed: breed.trim() || null,
                birthday: birthday || null,
                adopted_at: adoptedAt || null,
                avatar_url: avatarUrl,
                created_by: user?.id || '',
            }

            if (currentCatId) {
                // Update existing
                const { error } = await supabase
                    .from('cats')
                    .update(catData)
                    .eq('id', currentCatId)
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

            setMessage({ type: 'success', text: '档案保存成功！🎉' })
        } catch (err) {
            pushToast('error', getErrorMessage(err, '档案保存失败，请稍后重试'))
            setMessage({ type: 'error', text: '保存失败，请重试' })
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

    return (
        <div className="settings-page fade-in">
            <div className="page-header p-4">
                <h1 className="text-2xl font-bold">⚙️ 设置</h1>
                <p className="text-secondary text-sm">管理猫咪档案和账号</p>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`status-message status-${message.type} mx-4`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {/* Cat Profile Editor */}
            <form onSubmit={handleSave}>
                <div className="p-4">
                    <Card variant="default" padding="md">
                        <h2 className="text-lg font-semibold mb-3">😺 猫咪档案</h2>

                        {/* Avatar */}
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
                        <Button type="submit" variant="primary" fullWidth disabled={saving}>
                            {saving ? '保存中...' : '保存档案'}
                        </Button>
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

            {/* Sign Out */}
            <div className="p-4">
                <Button variant="ghost" fullWidth onClick={handleSignOut}>
                    退出登录
                </Button>
            </div>
        </div>
    )
}
