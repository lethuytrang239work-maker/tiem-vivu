// Tất cả request từ client đều qua đây — KHÔNG có Supabase key nào ở đây

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

async function call(path, opts = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...opts, headers })
  if (res.status === 204) return null
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

export const api = {
  // Auth
  login: (password) => call('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),

  // Items
  getItems: () => call('/api/items'),
  createItem: (data) => call('/api/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (data) => call('/api/items', { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id) => call(`/api/items?id=${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () => call('/api/orders'),
  lookupOrders: (customerId) => call(`/api/orders?customer_id=${customerId}`),
  createOrder: (data) => call('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (data) => call('/api/orders', { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrder: (id) => call(`/api/orders?id=${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: () => call('/api/customers'),
  getCustomer: (id) => call(`/api/customers?id=${id}`),
  createCustomer: (data) => call('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (data) => call('/api/customers', { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id) => call(`/api/customers?id=${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => call('/api/settings'),
  saveSetting: (key, value) => call('/api/settings', { method: 'POST', body: JSON.stringify({ key, value }) }),
  deleteSetting: (key) => call(`/api/settings?key=${key}`, { method: 'DELETE' }),

  // Upload
  uploadImage: (base64, contentType, filename) =>
    call('/api/upload', { method: 'POST', body: JSON.stringify({ base64, contentType, filename }) }),
}
