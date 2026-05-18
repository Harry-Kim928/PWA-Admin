import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthContextValue = {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  sendOtp: (phone: string) => Promise<{ error?: string }>
  verifyOtp: (phone: string, code: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[admin check] error:', error.message)
    return false
  }
  return data !== null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Returns true/false on resolved query, null on timeout (don't flip state)
    const adminCheckWithTimeout = (userId: string): Promise<boolean | null> =>
      Promise.race<boolean | null>([
        checkIsAdmin(userId).then((v) => v),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ])

    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        setSession(data.session)
        if (data.session) {
          const result = await adminCheckWithTimeout(data.session.user.id)
          if (!cancelled && result !== null) setIsAdmin(result)
        }
      } catch (err) {
        console.error('[auth] init failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s)
      if (event === 'SIGNED_OUT' || !s) {
        setIsAdmin(false)
        return
      }
      // Skip admin re-check on token refresh / unrelated updates.
      // Once we know the user is an admin, stay admin until SIGNED_OUT.
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return
      try {
        const result = await adminCheckWithTimeout(s.user.id)
        if (result !== null) setIsAdmin(result)
      } catch (err) {
        console.error('[auth] admin check failed:', err)
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const sendOtp: AuthContextValue['sendOtp'] = async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return error ? { error: error.message } : {}
  }

  const verifyOtp: AuthContextValue['verifyOtp'] = async (phone, code) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
    return error ? { error: error.message } : {}
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, isAdmin, sendOtp, verifyOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
