import { supabase } from './supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { useShallow } from 'zustand/shallow'

/** Sign in with email/username/phone + password */
export async function signIn(identifier: string, password: string) {
    let email = identifier

    // If identifier doesn't look like an email, look up from profiles
    if (!identifier.includes('@')) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .or(`username.eq.${identifier},phone.eq.${identifier}`)
            .maybeSingle()
        // Use generic error to prevent username enumeration
        if (!profile?.email) throw new Error('用户名或密码错误')
        email = profile.email
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
}

/**
 * Sign up with email + password.
 * Username & phone are stored via user_metadata and a DB trigger creates the profile row.
 */
export async function signUp(
    email: string,
    password: string,
    username: string,
    phone: string,
) {
    // 1. Check username uniqueness
    const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
    if (existing) throw new Error('该用户名已被占用')

    // 2. Create auth user — pass username & phone in metadata
    //    A DB trigger (handle_new_user) auto-creates the profiles row.
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username, phone: phone || null },
        },
    })
    if (error) throw error
    if (!data.user) throw new Error('注册失败，请稍后重试')

    return data
}

/** Send password reset email */
export async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
    })
    if (error) throw error
}

/** Update the current user's password */
export async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
}

/** Sign out */
export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

/**
 * React hook — reads auth state from the shared store.
 * No per-component subscriptions; a single auth listener
 * is created once via initAuth() at app startup.
 */
export function useSession() {
    return useAuthStore(useShallow((s) => ({
        session: s.session,
        user: s.user,
        loading: s.loading,
        isPasswordRecovery: s.isPasswordRecovery,
        clearPasswordRecovery: s.clearPasswordRecovery,
    })))
}
