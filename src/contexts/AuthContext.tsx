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

    const adminCheckWithTimeout = (userId: string) =>
      Promise.race<boolean>([
        checkIsAdmin(userId),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
      ])

    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        setSession(data.session)
        if (data.session) {
          const ok = await adminCheckWithTimeout(data.session.user.id)
          if (!cancelled) setIsAdmin(ok)
        }
      } catch (err) {
        console.error('[auth] init failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (!s) {
        setIsAdmin(false)
        return
      }
      try {
        setIsAdmin(await adminCheckWithTimeout(s.user.id))
      } catch (err) {
        console.error('[auth] admin check failed:', err)
        setIsAdmin(false)
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
