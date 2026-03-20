import { supabaseAdmin } from '../../lib/supabase'
import { requireAdmin } from '../../lib/auth'

export default async function handler(req, res) {
  // GET single customer by ID — public (dùng cho tra cứu)
  if (req.method === 'GET') {
    const { id } = req.query
    if (!id) {
      // Admin: lấy tất cả
      if (!requireAdmin(req, res)) return
      const { data, error } = await supabaseAdmin.from('customers').select('*').order('created_at')
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }
    // Lookup by customer ID — chỉ trả name + type, không expose CCCD hay địa chỉ
    const { data, error } = await supabaseAdmin
      .from('customers').select('id,name,phone,type,address').eq('id', id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Không tìm thấy' })
    return res.json(data)
  }

  if (!requireAdmin(req, res)) return

  if (req.method === 'POST') {
    const { data, error } = await supabaseAdmin.from('customers').insert(req.body).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { id, ...payload } = req.body
    const { data, error } = await supabaseAdmin.from('customers').update(payload).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.status(405).end()
}
