import { useState, useEffect, useRef } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { signOut, useSession } from '../lib/auth'
import { useCat } from '../lib/useCat'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import './SettingsPage.css'

export function SettingsPage() {
    const { user } = useSession()
    const { cat, catId } = useCat()
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const pushToast = useToastStore((s) => s.pushToast)

    const [name, setName] = useState('')
    const [breed, setBreed] = useState('')
    const [birthday, setBirthday] = useState('')
    const [adoptedAt, setAdoptedAt] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Populate form when cat is loaded via shared hook
    useEffect(() => {
        if (!cat) return
        setName(cat.name)
        setBreed(cat.breed || '')
        setBirthday(cat.birthday || '')
        setAdoptedAt(cat.adopted_at || '')
        setAvatarUrl(cat.avatar_url)
    }, [cat])

    // Upload avatar to Supabase Storage
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

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

            if (catId) {
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
