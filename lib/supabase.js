// Server-only — KHÔNG import file này vào pages/ hay components/
// Chỉ dùng trong pages/api/
import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
if (!process.env.SUPABASE_SERVICE_KEY)     throw new Error('Missing SUPABASE_SERVICE_KEY')

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)
