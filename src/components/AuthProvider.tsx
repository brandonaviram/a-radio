import { useEffect, ReactNode } from 'react'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  useEffect(() => {
    // Clean up auth_token from URL if present (from cross-subdomain redirect)
    const urlParams = new URLSearchParams(window.location.search)
    const authToken = urlParams.get('auth_token')

    if (authToken) {
      console.log('[Auth] Found auth_token in URL, cleaning up...')
      const cleanUrl = new URL(window.location.href)
      cleanUrl.searchParams.delete('auth_token')
      window.history.replaceState({}, '', cleanUrl.toString())
    }
  }, [])

  // Auth disabled for now - just render children
  return <>{children}</>
}
