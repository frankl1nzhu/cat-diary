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

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    const headers: Record<string, string> = {}
    if (anonKey) {
        headers.apikey = anonKey
    }
    if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
    }

    return supabase.functions.invoke('send-reminders', {
        body,
        headers,
    })
}

export async function sendTestPush() {
    const { error } = await invokeSendReminders({ action: 'test' })

    if (error) throw error
}

export async function sendReminderPush(catId?: string) {
    const { error } = await invokeSendReminders({ action: 'reminder', catId })

    if (error) throw error
}

export async function sendDiaryNotification(catId: string, catName: string) {
    const { error } = await invokeSendReminders({ action: 'diary', catId, catName })

    if (error) throw error
}

export async function sendCommentNotification(diaryAuthorId: string, catName: string) {
    const { error } = await invokeSendReminders({ action: 'comment', diaryAuthorId, catName })

    if (error) throw error
}

export async function sendScoopNotification(catId: string, catName: string) {
    const { error } = await invokeSendReminders({ action: 'scoop', catId, catName })

    if (error) throw error
}

export async function sendFeedNotification(catId: string, catName: string, mealType: string) {
    const { error } = await invokeSendReminders({ action: 'feed', catId, catName, mealType })

    if (error) throw error
}

export async function sendAbnormalPoopNotification(catId: string, catName: string, bristolType: string, poopColor: string) {
    const { error } = await invokeSendReminders({ action: 'abnormal-poop', catId, catName, bristolType, poopColor })

    if (error) throw error
}

export async function sendHealthNotification(catId: string, catName: string, healthType: string, healthName: string) {
    const { error } = await invokeSendReminders({ action: 'health', catId, catName, healthType, healthName })

    if (error) throw error
}

export async function sendInventoryNotification(catId: string, catName: string, itemName: string) {
    const { error } = await invokeSendReminders({ action: 'inventory', catId, catName, itemName })

    if (error) throw error
}

export async function sendWeightNotification(catId: string, catName: string, weightKg: number) {
    const { error } = await invokeSendReminders({ action: 'weight', catId, catName, weightKg })

    if (error) throw error
}

export async function sendCatProfileNotification(catId: string, catName: string) {
    const { error } = await invokeSendReminders({ action: 'cat-profile', catId, catName })

    if (error) throw error
}

export async function sendFamilyMemberNotification(familyId: string, memberName: string) {
    const { error } = await invokeSendReminders({ action: 'family-member', familyId, memberName })

    if (error) throw error
}

export async function sendNewCatNotification(catId: string, catName: string) {
    const { error } = await invokeSendReminders({ action: 'new-cat', catId, catName })

    if (error) throw error
}

export async function sendWeeklySummary(catId: string, catName: string) {
    const { error } = await invokeSendReminders({ action: 'weekly-summary', catId, catName })

    if (error) throw error
}
