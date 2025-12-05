import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars - auth will be disabled')
}

// Get the project ref from the Supabase URL for cookie name
const getProjectRef = () => {
  if (!supabaseUrl) return ''
  const match = supabaseUrl.match(/https:\/\/([^.]+)/)
  return match ? match[1] : ''
}

// Custom cookie storage for cross-subdomain auth
// Reads cookies set by aviram.xyz on .aviram.xyz domain
// Handles Supabase SSR chunked cookies (.0, .1, .2, etc.)
const cookieStorage = {
  getItem: (key: string) => {
    // First try direct cookie (non-chunked)
    const directMatch = document.cookie.match(new RegExp(`(^| )${key}=([^;]+)`))
    if (directMatch) {
      return decodeURIComponent(directMatch[2])
    }

    // Try chunked cookies (.0, .1, .2, etc.)
    const chunks: string[] = []
    let i = 0
    while (true) {
      const chunkKey = `${key}.${i}`
      const chunkMatch = document.cookie.match(new RegExp(`(^| )${chunkKey}=([^;]+)`))
      if (!chunkMatch) break
      chunks.push(decodeURIComponent(chunkMatch[2]))
      i++
    }

    if (chunks.length > 0) {
      const reassembled = chunks.join('')
      console.log('[Supabase Storage] Reassembled', chunks.length, 'chunks for:', key)
      return reassembled
    }

    return null
  },
  setItem: (_key: string, _value: string) => {
    // Don't set cookies from radio - aviram.xyz hub handles this
    console.log('[Supabase Storage] setItem called (ignored):', _key)
  },
  removeItem: (_key: string) => {
    // Don't remove cookies from radio - aviram.xyz hub handles this
    console.log('[Supabase Storage] removeItem called (ignored):', _key)
  },
}

const projectRef = getProjectRef()

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: cookieStorage,
        storageKey: `sb-${projectRef}-auth-token`, // Match Supabase's actual cookie name
        autoRefreshToken: false, // Hub handles token refresh
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : null

export const AUTH_HUB_URL = import.meta.env.VITE_AUTH_HUB_URL || 'https://www.aviram.xyz'
