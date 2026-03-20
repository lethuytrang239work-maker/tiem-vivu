import { supabaseAdmin } from '../../lib/supabase'
import { requireAdmin } from '../../lib/auth'

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireAdmin(req, res)) return

  const { base64, contentType, filename } = req.body
  if (!base64 || !contentType) return res.status(400).json({ error: 'Missing data' })

  const buffer = Buffer.from(base64, 'base64')
  const ext = contentType.split('/')[1] || 'jpg'
  const path = `bang-gia.${ext}`

  const { error: upErr } = await supabaseAdmin.storage
    .from('vivu-assets')
    .upload(path, buffer, { upsert: true, contentType })

  if (upErr) return res.status(500).json({ error: upErr.message })

  const { data } = supabaseAdmin.storage.from('vivu-assets').getPublicUrl(path)
  const publicUrl = data.publicUrl + '?t=' + Date.now()

  // Lưu URL vào app_settings
  await supabaseAdmin.from('app_settings')
    .upsert({ key: 'bang-gia', value: publicUrl }, { onConflict: 'key' })

  res.json({ url: publicUrl })
}
