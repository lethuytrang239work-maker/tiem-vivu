import { signAdminToken } from '../../../lib/auth'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { password } = req.body || {}
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mật khẩu không đúng' })
  }
  const token = signAdminToken()
  res.json({ token })
}
