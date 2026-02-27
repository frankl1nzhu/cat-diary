import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

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
        if (!profile?.email) throw new Error('未找到该用户')
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

/** React hook — subscribe to auth state changes */
export function useSession() {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    return { session, user, loading, isPasswordRecovery, clearPasswordRecovery: () => setIsPasswordRecovery(false) }
}
