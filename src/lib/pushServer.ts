import { supabase } from './supabase'

interface StoredPushSubscription {
    endpoint: string
    keys?: {
        p256dh?: string
        auth?: string
    }
}

export async function savePushSubscription(userId: string, subscriptionJson: PushSubscriptionJSON) {
    const payload = subscriptionJson as unknown as StoredPushSubscription
    const endpoint = payload.endpoint
    const p256dh = payload.keys?.p256dh
    const auth = payload.keys?.auth

    if (!endpoint || !p256dh || !auth) {
        throw new Error('Push subscription data incomplete')
    }

    const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
            {
                user_id: userId,
                endpoint,
                p256dh,
                auth,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'endpoint' }
        )

    if (error) throw error
}

async function invokeSendReminders(body: Record<string, unknown>) {
    const {
        data: { session },
    } = await supabase.auth.getSession()

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase env missing for push function invoke')
    }

    const invokeHeaders: Record<string, string> = {}
    if (session?.access_token) {
        invokeHeaders.Authorization = `Bearer ${session.access_token}`
    }

    const { data: invokeData, error: invokeError } = await supabase.functions.invoke('send-reminders', {
        body,
        headers: Object.keys(invokeHeaders).length > 0 ? invokeHeaders : undefined,
    })
    if (!invokeError) {
        return invokeData
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: anonKey,
    }
    if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-reminders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    })

    let payload: unknown = null
    try {
        payload = await response.json()
    } catch {
        payload = null
    }

    if (!response.ok) {
        if (response.status === 401) {
            const { data, error } = await supabase.functions.invoke('send-reminders', {
                body,
                headers: Object.keys(invokeHeaders).length > 0 ? invokeHeaders : undefined,
            })
            if (!error) {
                return data
            }
        }
        const message = typeof payload === 'object' && payload && 'error' in payload
            ? String((payload as { error?: unknown }).error)
            : `HTTP ${response.status}`
        throw new Error(`send-reminders failed: ${message}`)
    }

    return payload
}

export async function sendTestPush() {
    await invokeSendReminders({ action: 'test' })
}

export async function sendReminderPush(catId?: string) {
    await invokeSendReminders({ action: 'reminder', catId })
}

export async function sendDiaryNotification(catId: string, catName: string) {
    await invokeSendReminders({ action: 'diary', catId, catName })
}

export async function sendCommentNotification(diaryAuthorId: string, catName: string) {
    await invokeSendReminders({ action: 'comment', diaryAuthorId, catName })
}

export async function sendScoopNotification(catId: string, catName: string) {
    await invokeSendReminders({ action: 'scoop', catId, catName })
}

export async function sendFeedNotification(catId: string, catName: string, mealType: string) {
    await invokeSendReminders({ action: 'feed', catId, catName, mealType })
}

export async function sendAbnormalPoopNotification(catId: string, catName: string, bristolType: string, poopColor: string) {
    await invokeSendReminders({ action: 'abnormal-poop', catId, catName, bristolType, poopColor })
}

export async function sendHealthNotification(catId: string, catName: string, healthType: string, healthName: string) {
    await invokeSendReminders({ action: 'health', catId, catName, healthType, healthName })
}

export async function sendInventoryNotification(catId: string, catName: string, itemName: string) {
    await invokeSendReminders({ action: 'inventory', catId, catName, itemName })
}

export async function sendWeightNotification(catId: string, catName: string, weightKg: number) {
    await invokeSendReminders({ action: 'weight', catId, catName, weightKg })
}

export async function sendCatProfileNotification(catId: string, catName: string) {
    await invokeSendReminders({ action: 'cat-profile', catId, catName })
}

export async function sendFamilyMemberNotification(familyId: string, memberName: string) {
    await invokeSendReminders({ action: 'family-member', familyId, memberName })
}

export async function sendFamilyJoinRequestNotification(familyId: string, requesterName: string) {
    await invokeSendReminders({ action: 'family-join-request', familyId, memberName: requesterName })
}

export async function sendFamilyMemberLeftNotification(familyId: string, memberName: string) {
    await invokeSendReminders({ action: 'family-member-left', familyId, memberName })
}

export async function sendNewCatNotification(catId: string, catName: string) {
    await invokeSendReminders({ action: 'new-cat', catId, catName })
}

export async function sendWeeklySummary(catId: string, catName: string) {
    await invokeSendReminders({ action: 'weekly-summary', catId, catName })
}

export async function sendMissNotification(catId: string, catName: string) {
    await invokeSendReminders({ action: 'miss', catId, catName })
}
