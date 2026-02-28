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

export async function sendTestPush() {
    const { error } = await supabase.functions.invoke('send-reminders', {
        body: { action: 'test' },
    })

    if (error) throw error
}

export async function sendReminderPush(catId?: string) {
    const { error } = await supabase.functions.invoke('send-reminders', {
        body: { action: 'reminder', catId },
    })

    if (error) throw error
}

export async function sendDiaryNotification(catId: string, catName: string) {
    const { error } = await supabase.functions.invoke('send-reminders', {
        body: { action: 'diary', catId, catName },
    })

    if (error) throw error
}

export async function sendCommentNotification(diaryAuthorId: string, catName: string) {
    const { error } = await supabase.functions.invoke('send-reminders', {
        body: { action: 'comment', diaryAuthorId, catName },
    })

    if (error) throw error
}
