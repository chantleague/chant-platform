import { createClient } from '@supabase/supabase-js'

export type ChantPack = {
  id: string
  match_id: string
  title: string
  description: string
  audio_url: string
  created_at: string
  updated_at: string
  official: boolean
}

export type Match = {
  id: string
  slug: string
  title: string
  description: string
  home_team: string
  away_team: string
  matchday: number
  status: 'upcoming' | 'live' | 'completed'
  starts_at: string
  created_at: string
  updated_at: string
}

export type ChantVote = {
  id: string
  chant_pack_id: string
  user_id: string
  created_at: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let supabase: any

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  // Fallback for build time - returns empty results
  supabase = {
    from: () => ({ 
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ error: null }),
      eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) })
    }),
    storage: { 
      from: () => ({ 
        upload: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ publicUrl: '' })
      })
    }
  }
}

export { supabase }
