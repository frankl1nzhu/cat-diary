import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Sign in with email and password */
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
}

/** Sign up with email + password, then write profile (username & phone) */
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

    // 2. Create auth user
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (!data.user) throw new Error('注册失败，请稍后重试')

    // 3. Insert profile row
    const { error: profileErr } = await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        phone: phone || null,
        email,
    } as never)
    if (profileErr) throw profileErr

    return data
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
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    return { session, user, loading }
}
