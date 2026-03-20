import { supabaseAdmin } from '../../lib/supabase'
import { requireAdmin } from '../../lib/auth'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Public — khách và admin đều đọc được
    const { data, error } = await supabaseAdmin.from('items').select('*').order('id')
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // Mọi thao tác ghi đều cần admin
  if (!requireAdmin(req, res)) return

  if (req.method === 'POST') {
    const { data, error } = await supabaseAdmin.from('items').insert(req.body).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { id, ...payload } = req.body
    const { data, error } = await supabaseAdmin.from('items').update(payload).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    const { error } = await supabaseAdmin.from('items').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.status(405).end()
}
