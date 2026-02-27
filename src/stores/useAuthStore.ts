import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/* ─── Auth Store ─────────────────────────────────────
 *  Single auth subscription for the entire app.
 *  Replaces per-component subscriptions from useSession().
 * ──────────────────────────────────────────────────── */

interface AuthState {
    session: Session | null
    user: User | null
    loading: boolean
    isPasswordRecovery: boolean
    clearPasswordRecovery: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
    session: null,
    user: null,
    loading: true,
    isPasswordRecovery: false,
    clearPasswordRecovery: () => set({ isPasswordRecovery: false }),
}))

/**
 * Call once at app startup to create the single auth subscription.
 * Returns a cleanup function.
 */
export function initAuth(): () => void {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
        useAuthStore.setState({
            session,
            user: session?.user ?? null,
            loading: false,
        })
    })

    // Listen for auth changes (single subscription for the entire app)
    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
        useAuthStore.setState({
            session,
            user: session?.user ?? null,
            loading: false,
        })
        if (event === 'PASSWORD_RECOVERY') {
            useAuthStore.setState({ isPasswordRecovery: true })
        }
    })

    return () => subscription.unsubscribe()
}
