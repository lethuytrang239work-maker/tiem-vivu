import { supabaseAdmin } from '../../lib/supabase'
import { requireAdmin } from '../../lib/auth'

export default async function handler(req, res) {
  // GET: public (khách đọc bảng giá / rules)
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('app_settings').select('key,value')
    if (error) return res.status(500).json({ error: error.message })
    return res.json(Object.fromEntries((data || []).map(r => [r.key, r.value])))
  }

  if (!requireAdmin(req, res)) return

  if (req.method === 'POST') {
    const { key, value } = req.body
    const { error } = await supabaseAdmin
      .from('app_settings').upsert({ key, value }, { onConflict: 'key' })
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { key } = req.query
    const { error } = await supabaseAdmin.from('app_settings').delete().eq('key', key)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.status(405).end()
}
