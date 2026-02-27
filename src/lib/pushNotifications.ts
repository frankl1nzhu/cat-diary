const PUSH_SUB_KEY = 'cat_diary_push_subscription'

function isIosSafariBrowser() {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent
    const isiOS = /iPhone|iPad|iPod/i.test(ua)
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)
    return isiOS && isSafari
}

function isStandaloneDisplayMode() {
    if (typeof window === 'undefined') return false
    const iosStandalone = typeof (navigator as Navigator & { standalone?: boolean }).standalone === 'boolean'
        ? Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
        : false
    const mediaStandalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
    return iosStandalone || mediaStandalone
}

function base64UrlToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let index = 0; index < rawData.length; ++index) {
        outputArray[index] = rawData.charCodeAt(index)
    }
    return outputArray
}

export async function enablePushNotifications() {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        return { ok: false as const, reason: 'unsupported' as const }
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (isIosSafariBrowser() && !isStandaloneDisplayMode()) {
            return { ok: false as const, reason: 'ios-add-to-home-screen' as const }
        }
        return { ok: false as const, reason: 'unsupported-push' as const }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
        return { ok: false as const, reason: 'denied' as const }
    }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
    if (!vapidPublicKey) {
        return { ok: true as const, subscribed: false as const, reason: 'no-vapid-key' as const }
    }

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
        const subscriptionJson = existing.toJSON()
        localStorage.setItem(PUSH_SUB_KEY, JSON.stringify(subscriptionJson))
        return {
            ok: true as const,
            subscribed: true as const,
            reason: 'already-subscribed' as const,
            subscription: subscriptionJson,
        }
    }

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
    })

    const subscriptionJson = subscription.toJSON()
    localStorage.setItem(PUSH_SUB_KEY, JSON.stringify(subscriptionJson))
    return {
        ok: true as const,
        subscribed: true as const,
        reason: 'subscribed' as const,
        subscription: subscriptionJson,
    }
}
