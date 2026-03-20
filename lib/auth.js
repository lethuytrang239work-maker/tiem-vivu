import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET
if (!SECRET) throw new Error('Missing JWT_SECRET')

export function signAdminToken() {
  return jwt.sign({ role: 'admin' }, SECRET, { expiresIn: '8h' })
}

export function verifyAdminToken(token) {
  try {
    const payload = jwt.verify(token, SECRET)
    return payload?.role === 'admin'
  } catch {
    return false
  }
}

// Middleware helper — dùng trong API routes
export function requireAdmin(req, res) {
  const auth = req.headers.authorization || ''
  const token = auth.replace('Bearer ', '')
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}
