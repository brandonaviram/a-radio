import { useState, useEffect, ReactNode } from 'react'
import { supabase, AUTH_HUB_URL } from '../lib/supabase'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check for auth_token in URL (from cross-subdomain redirect)
        const urlParams = new URLSearchParams(window.location.search)
        const authToken = urlParams.get('auth_token')

        if (authToken) {
          console.log('[Auth] Found auth_token in URL, accepting...')

          // Trust the token - the hub already verified the user when issuing it
          // Clean up URL (remove auth_token param)
          const cleanUrl = new URL(window.location.href)
          cleanUrl.searchParams.delete('auth_token')
          window.history.replaceState({}, '', cleanUrl.toString())

          setLoading(false)
          return
        }

        // Try reading session from shared cookies via Supabase client
        if (supabase) {
          console.log('[Auth] Checking session via Supabase client (cookie-based)...')
          const { data: { session }, error } = await supabase.auth.getSession()

          if (session && !error) {
            console.log('[Auth] Session found via cookies:', session.user.email)
            setLoading(false)
            return
          }
          console.log('[Auth] No session from cookies:', error?.message || 'no session')
        }

        // No session - redirect to auth hub
        const currentUrl = window.location.href
        const authUrl = `${AUTH_HUB_URL}/auth?redirect=${encodeURIComponent(currentUrl)}`
        console.log('[Auth] No session, redirecting to hub:', authUrl)
        window.location.href = authUrl
      } catch (err) {
        console.error('[Auth] Error checking session:', err)
        // On error, redirect to auth
        const currentUrl = window.location.href
        window.location.href = `${AUTH_HUB_URL}/auth?redirect=${encodeURIComponent(currentUrl)}`
      }
    }

    checkSession()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-600 text-xs uppercase tracking-widest animate-pulse">
          AUTHENTICATING...
        </div>
      </div>
    )
  }

  return <>{children}</>
}
