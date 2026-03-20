import { supabaseAdmin } from '../../lib/supabase'
import { requireAdmin } from '../../lib/auth'

export default async function handler(req, res) {
  // GET: admin lấy tất cả, khách chỉ lấy theo customer_name
  if (req.method === 'GET') {
    const isAdmin = (() => {
      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '')
        if (!token) return false
        const { verifyAdminToken } = require('../../lib/auth')
        return verifyAdminToken(token)
      } catch { return false }
    })()

    if (isAdmin) {
      // Admin: lấy tất cả đơn
      const { data, error } = await supabaseAdmin
        .from('orders').select('*').order('created_at', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    } else {
      // Khách: bắt buộc phải truyền customer_id
      const { customer_id } = req.query
      if (!customer_id) return res.status(400).json({ error: 'Thiếu customer_id' })

      // Tìm tên khách theo ID trước
      const { data: cust, error: custErr } = await supabaseAdmin
        .from('customers').select('name').eq('id', customer_id).maybeSingle()
      if (custErr || !cust) return res.status(404).json({ error: 'Không tìm thấy mã khách' })

      // Lấy đơn theo tên — chỉ trả về fields cần thiết, ẩn info nhạy cảm
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('id,item_id,start_date,end_date,start_hour,end_hour,status,type,address,tracking_code,phone,note,deposit,paid_deposit,custom_price,discount,discount_type,rent_mode,created_at')
        .eq('customer_name', cust.name)
        .order('created_at', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })

      return res.json({ customer: cust, orders: data })
    }
  }

  // Mọi ghi cần admin
  if (!requireAdmin(req, res)) return

  if (req.method === 'POST') {
    const { data, error } = await supabaseAdmin.from('orders').insert(req.body).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { id, ...payload } = req.body
    const { data, error } = await supabaseAdmin.from('orders').update(payload).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    const { error } = await supabaseAdmin.from('orders').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.status(405).end()
}
