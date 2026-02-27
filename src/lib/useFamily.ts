import { useState } from 'react'
import { supabase } from './supabase'
import { useCat } from './useCat'
import { useSession } from './auth'
import { useToastStore } from '../stores/useToastStore'
import { reloadCatData } from '../stores/useCatStore'
import { getErrorMessage } from './errorMessage'
import type { Family } from '../types/database.types'

interface FamilyRpcResult {
    id: string
    name: string
    invite_code: string
}

/**
 * Shared hook for family create/join operations.
 * Deduplicates logic from DashboardPage and SettingsPage.
 */
export function useFamily() {
    const { user } = useSession()
    const { catId, setActiveFamilyId } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)
    const [familySaving, setFamilySaving] = useState(false)

    const createFamily = async (
        familyName: string,
        opts?: { assignCat?: boolean; onSuccess?: (family: FamilyRpcResult) => void },
    ) => {
        if (!user) return
        const nameValue = familyName.trim()
        if (!nameValue) {
            pushToast('error', '请输入家庭名称')
            return
        }

        setFamilySaving(true)
        try {
            const { data, error } = await supabase.rpc('create_family_with_owner', { family_name: nameValue })
            if (error) throw error
            const newFamily = data as unknown as FamilyRpcResult
            if (!newFamily?.id) throw new Error('家庭创建失败')

            if (opts?.assignCat && catId) {
                await supabase.from('cats').update({ family_id: newFamily.id }).eq('id', catId)
            }

            setActiveFamilyId(newFamily.id)
            reloadCatData()
            pushToast('success', `家庭已创建，邀请码：${newFamily.invite_code}`)
            opts?.onSuccess?.(newFamily)
        } catch (err) {
            pushToast('error', getErrorMessage(err, '创建家庭失败，请稍后重试'))
        } finally {
            setFamilySaving(false)
        }
    }

    const joinFamily = async (
        code: string,
        opts?: { assignCat?: boolean; onSuccess?: (family: FamilyRpcResult) => void },
    ) => {
        if (!user) return
        const cleanCode = code.trim().toUpperCase()
        if (!cleanCode) {
            pushToast('error', '请输入邀请码')
            return
        }

        setFamilySaving(true)
        try {
            const { data, error } = await supabase.rpc('join_family_by_code', { code: cleanCode })
            if (error) throw error
            const family = data as unknown as FamilyRpcResult
            if (!family?.id) throw new Error('家庭不存在')

            if (opts?.assignCat && catId) {
                await supabase.from('cats').update({ family_id: family.id }).eq('id', catId)
            }

            setActiveFamilyId(family.id)
            reloadCatData()
            pushToast('success', `已加入家庭：${family.name}`)
            opts?.onSuccess?.(family)
        } catch (err) {
            pushToast('error', getErrorMessage(err, '加入家庭失败，请检查邀请码'))
        } finally {
            setFamilySaving(false)
        }
    }

    return { createFamily, joinFamily, familySaving } as const
}

/** Cast RPC data to Family type. */
export function toFamily(data: unknown): Family {
    return data as Family
}
