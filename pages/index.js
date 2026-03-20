import { useEffect, useRef, useState, useCallback } from 'react'
import Head from 'next/head'
import { api } from '../lib/api'

// ── HELPERS ──
const fmt = n => n ? Number(n).toLocaleString('vi-VN') + 'đ' : '—'
const fmtK = n => n ? (Number(n) / 1000).toFixed(0) + 'k' : '—'
const fmtD = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''
const dDiff = (s, e) => Math.max(1, Math.round((new Date(e) - new Date(s)) / 86400000) + 1)
const isAcc = it => it?.type === 'Phụ kiện'
const PAGE_SIZE = 10

const STATUSES = [
  { k: 'deposit',   l: 'Chờ lấy đồ',   c: 's-dep' },
  { k: 'ship-to',   l: 'Đang ship đến', c: 's-shi' },
  { k: 'renting',   l: 'Đang thuê',     c: 's-ren' },
  { k: 'ship-back', l: 'Đang ship về',  c: 's-shb' },
  { k: 'done',      l: 'Đã trả',        c: 's-don' },
]
const SM = Object.fromEntries(STATUSES.map(s => [s.k, s]))

function getPrice(o, items) {
  const it = items.find(i => i.id === o.item_id)
  if (!it) return 0
  if (o.custom_price && o.custom_price > 0) {
    let pr = Number(o.custom_price)
    if (o.discount > 0) {
      const d = o.discount_type === 'pct' ? Math.round(pr * Math.min(o.discount, 100) / 100) : Math.min(o.discount, pr)
      pr = Math.max(0, pr - d)
    }
    return pr
  }
  let hours = 0
  if (o.start_date && o.end_date) {
    const sh = o.start_hour || 10, eh = o.end_hour || 10
    hours = Math.max(0, (new Date(o.end_date + 'T' + String(eh).padStart(2, '0') + ':00:00') - new Date(o.start_date + 'T' + String(sh).padStart(2, '0') + ':00:00')) / 3600000)
  }
  const tier = hours <= 24 ? 1 : hours <= 48 ? 2 : 3
  let pr = 0
  if (isAcc(it)) {
    pr = o.rent_mode === 'chungJK'
      ? tier === 1 ? (it.pc1 || 0) : tier === 2 ? (it.pc2 || it.pc1 || 0) : (it.pc3 || it.pc2 || it.pc1 || 0)
      : tier === 1 ? (it.pr1 || 0) : tier === 2 ? (it.pr2 || it.pr1 || 0) : (it.pr3 || it.pr2 || it.pr1 || 0)
  } else {
    pr = tier === 1 ? (it.p1 || 0) : tier === 2 ? (it.p2 || it.p1 || 0) : (it.p3 || it.p2 || it.p1 || 0)
  }
  if (o.discount > 0) {
    const d = o.discount_type === 'pct' ? Math.round(pr * Math.min(o.discount, 100) / 100) : Math.min(o.discount, pr)
    pr = Math.max(0, pr - d)
  }
  return pr
}

// ── TOAST ──
function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg, type = '') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return { toasts, toast }
}

// ── MAIN APP ──
export default function Home() {
  const [role, setRole] = useState(null)      // null | 'customer' | 'admin'
  const [view, setView] = useState('cust-home')
  const [items, setItems] = useState([])
  const [orders, setOrders] = useState([])
  const [custs, setCusts] = useState([])
  const [custOrders, setCustOrders] = useState([])
  const [custData, setCustData] = useState(null)
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [adminModal, setAdminModal] = useState(false)
  const [adminPw, setAdminPw] = useState('')
  const [adminErr, setAdminErr] = useState('')
  const { toasts, toast } = useToast()

  // Load public data on mount
  useEffect(() => {
    Promise.all([
      api.getItems().then(setItems).catch(() => {}),
      api.getOrders().then(d => { /* public orders for calendar */ }).catch(() => {}),
      api.getSettings().then(setSettings).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  // ── AUTH ──
  async function enterAdmin() {
    setAdminErr('')
    try {
      const { token } = await api.login(adminPw)
      localStorage.setItem('admin_token', token)
      setRole('admin')
      setAdminModal(false)
      setAdminPw('')
      // Load admin data
      const [o, c] = await Promise.all([api.getOrders(), api.getCustomers()])
      setOrders(o)
      setCusts(c)
      setView('dashboard')
    } catch (e) {
      setAdminErr(e.message || 'Mật khẩu không đúng')
    }
  }
  function doLogout() {
    localStorage.removeItem('admin_token')
    setRole(null)
    setOrders([])
    setCusts([])
    setView('cust-home')
  }

  // ── LOOKUP ──
  const [lookupCode, setLookupCode] = useState('')
  const [lookupErr, setLookupErr] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  async function doLookup() {
    const code = lookupCode.trim().toUpperCase()
    if (!code) return setLookupErr('Vui lòng nhập mã khách')
    if (!/^KH\d{5,}$/.test(code)) return setLookupErr('Mã không hợp lệ (vd: KH4820001)')
    setLookupErr(''); setLookupLoading(true)
    try {
      const result = await api.lookupOrders(code)
      setCustData(result.customer)
      setCustOrders(result.orders)
      setView('cust-orders')
    } catch (e) {
      setLookupErr(e.message || 'Không tìm thấy')
    } finally { setLookupLoading(false) }
  }

  const isAdmin = role === 'admin'
  const showView = (v) => setView(v)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32 }}>✦</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 700 }}>Đang tải Tiệm Vivu...</div>
    </div>
  )

  return (
    <>
      <Head>
        <title>Tiệm Vivu</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div className="screen-app">
        {/* ── TOPBAR ── */}
        {isAdmin ? (
          <div className="topbar">
            <div className="t-logo">✦ Tiệm Vivu</div>
            <div className="t-nav">
              {[['dashboard','🏠 Tổng quan'],['board','📋 Đơn thuê'],['calendar','📅 Lịch'],null,['items','👕 Kho đồ'],['customers','👤 Khách hàng'],null,['revenue','💰 Doanh thu'],null,['settings','⚙️ Cài đặt']].map((item, i) =>
                !item ? <div key={i} className="t-sep" /> :
                <button key={item[0]} className={`t-tab${view === item[0] ? ' on' : ''}`} onClick={() => showView(item[0])}>{item[1]}</button>
              )}
            </div>
            <div className="t-right">
              <button className="t-btn new" onClick={() => {}}>＋ Đơn mới</button>
              <button className="t-btn out" onClick={doLogout}>Thoát</button>
            </div>
          </div>
        ) : (
          <div className="topbar">
            <div className="t-logo">✦ Tiệm Vivu</div>
            <div className="t-nav">
              {[['cust-home','🏠 Home'],['cust-items','👕 Kho đồ & Lịch'],['cust-lookup','🔍 Tra cứu']].map(([v, l]) =>
                <button key={v} className={`t-tab${view === v || (v === 'cust-lookup' && view === 'cust-orders') ? ' on' : ''}`} onClick={() => setView(v)}>{l}</button>
              )}
            </div>
            <div className="t-right">
              <button className="t-btn out" title="Đăng nhập Admin" onClick={() => setAdminModal(true)}>👑</button>
            </div>
          </div>
        )}

        <div className="main">
          {/* ── HOME ── */}
          {view === 'cust-home' && <HomeView settings={settings} />}

          {/* ── KHO ĐỒ KHÁCH ── */}
          {view === 'cust-items' && <CustItemsView items={items} orders={orders} />}

          {/* ── TRA CỨU ── */}
          {view === 'cust-lookup' && (
            <div className="cv">
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>🔍 Tra cứu đơn thuê</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>Nhập mã khách hàng shop đã cung cấp</p>
                <div className="fl" style={{ marginBottom: 0 }}>
                  <label className="lbl">Mã khách hàng</label>
                  <input className="inp" value={lookupCode} onChange={e => setLookupCode(e.target.value.toUpperCase())}
                    placeholder="KH4820001" onKeyDown={e => e.key === 'Enter' && doLookup()}
                    style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, letterSpacing: '.12em', textAlign: 'center', textTransform: 'uppercase' }} />
                  <div className="err-msg">{lookupErr}</div>
                </div>
                <button className="sub-btn" style={{ marginTop: 12 }} onClick={doLookup} disabled={lookupLoading}>
                  {lookupLoading ? '⏳ Đang tìm...' : 'Xem đơn của tôi →'}
                </button>
              </div>
            </div>
          )}

          {/* ── KẾT QUẢ TRA CỨU ── */}
          {view === 'cust-orders' && custData && (
            <div className="cv">
              <div className="cv-hd">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: '#fff', marginBottom: 3 }}>Xin chào, {custData.name} 👋</div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>Đơn thuê tại Tiệm Vivu</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 9, padding: '7px 13px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Mã KH</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '.08em', marginTop: 2 }}>{custData.id}</div>
                  </div>
                </div>
              </div>
              <OrderCards orders={custOrders} items={items} />
            </div>
          )}

          {/* ── ADMIN VIEWS ── */}
          {isAdmin && view === 'dashboard' && <DashboardView orders={orders} items={items} />}
          {isAdmin && view === 'board' && <BoardView orders={orders} setOrders={setOrders} items={items} toast={toast} />}
          {isAdmin && view === 'calendar' && <CalendarView orders={orders} items={items} />}
          {isAdmin && view === 'items' && <ItemsView items={items} setItems={setItems} orders={orders} toast={toast} />}
          {isAdmin && view === 'customers' && <CustomersView custs={custs} setCusts={setCusts} orders={orders} toast={toast} />}
          {isAdmin && view === 'revenue' && <RevenueView orders={orders} items={items} />}
          {isAdmin && view === 'settings' && <SettingsView settings={settings} setSettings={setSettings} toast={toast} />}
        </div>
      </div>

      {/* ── ADMIN LOGIN MODAL ── */}
      {adminModal && (
        <div className="ov" onClick={e => e.target === e.currentTarget && setAdminModal(false)}>
          <div className="mo-box" style={{ maxWidth: 360 }}>
            <div className="mo-hd">
              <h3>👑 Đăng nhập Admin</h3>
              <button className="mo-x" onClick={() => setAdminModal(false)}>×</button>
            </div>
            <div className="mo-bd">
              <div className="fg">
                <label className="lbl">Mật khẩu</label>
                <input className={`inp${adminErr ? ' err' : ''}`} type="password" value={adminPw}
                  onChange={e => setAdminPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && enterAdmin()}
                  placeholder="••••••••••••"
                  style={{ fontSize: 18, letterSpacing: '.1em', textAlign: 'center' }} autoFocus />
                <div className="err-msg">{adminErr}</div>
              </div>
            </div>
            <div className="mo-ft">
              <button className="sub-btn" onClick={enterAdmin}>Vào trang quản lý →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ── */}
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.type ? ' ' + t.type : ''}`}>
          {t.type === 'ok' ? '✓' : t.type === 'er' ? '✕' : ''} {t.msg}
        </div>
      ))}
    </>
  )
}

// ── HOME VIEW ──
function HomeView({ settings }) {
  return (
    <div className="cv">
      <div style={{ background: 'linear-gradient(145deg,#B01A14 0%,var(--red) 60%,#D42820 100%)', borderRadius: 'var(--r-lg)', padding: '32px 24px 28px', marginBottom: 16, textAlign: 'center', boxShadow: '0 6px 28px rgba(180,20,16,.3)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.15em', color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', marginBottom: 8 }}>✦ Cho thuê trang phục fandom ✦</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic', color: '#fff', marginBottom: 6 }}>Tiệm Vivu</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', marginBottom: 20, lineHeight: 1.5 }}>Jacket & Muffler T1 · LCK · Worlds<br />Chất lượng cao · Giá hợp lý · Ship toàn quốc</p>
        <a href="https://m.me/tiemvivu" target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '12px 28px', borderRadius: 50, background: '#fff', color: 'var(--red)', fontWeight: 800, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
          💬 Nhắn tin đặt thuê ngay
        </a>
      </div>

      {/* Bảng giá Jacket */}
      <PriceTable />

      {/* Ảnh upload từ admin */}
      {settings['bang-gia'] && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="ct">📋 Bảng giá (cập nhật)</div>
          <img src={settings['bang-gia']} alt="Bảng giá" style={{ width: '100%', borderRadius: 8 }} />
        </div>
      )}

      {/* Quy định */}
      <RulesSection customHtml={settings['rules-html']} />

      <a href="https://m.me/tiemvivu" target="_blank" rel="noreferrer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', padding: 13, borderRadius: 'var(--r-lg)', background: 'var(--red)', color: '#fff', fontWeight: 800, fontSize: 14, marginTop: 4 }}>
        💬 Muốn thuê thêm? Liên hệ ngay
      </a>
    </div>
  )
}

function PriceTable() {
  const jackets = [
    { name: 'LCK Spring 2024 — FAKER', size: 'M', price: '200k' },
    { name: 'Jacket Worlds 2025 — FAKER', size: 'L', price: '180k' },
    { name: 'Jacket 2025 2nd — FAKER', size: 'M', price: '130k' },
    { name: 'Jacket LCK 2026 — FAKER', size: 'L', price: '180k' },
    { name: 'Jacket LCK 2026 — DORAN', size: 'L', price: '180k' },
  ]
  const mufflers = [
    { name: 'Muffler 2024 Đỏ Đen', rieng: '80k', chung: '50k' },
    { name: 'Muffler 2023', rieng: '60k', chung: '35k' },
    { name: 'Muffler V6 (Vàng)', rieng: '60k', chung: '35k' },
  ]
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ background: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff' }}>JACKET</div>
          <div style={{ height: 1, flex: 1, background: 'var(--line)' }}></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jackets.map(j => (
            <div key={j.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, borderLeft: '3px solid var(--red)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{j.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Size {j.size}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{j.price}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>/ 1 ngày</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--gold-bg)', borderRadius: 8, fontSize: 11, color: 'var(--gold)', fontWeight: 600, lineHeight: 1.5 }}>
          💡 Giá đã bao gồm phí giặt khô · Thuê &gt;1 ngày được giảm phí giặt
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ background: 'var(--purple)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff' }}>MUFFLER</div>
          <div style={{ height: 1, flex: 1, background: 'var(--line)' }}></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 4, marginBottom: 8, padding: '0 4px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sản phẩm</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textAlign: 'center' }}>Thuê riêng</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textAlign: 'center' }}>+ JK</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mufflers.map(m => (
            <div key={m.name} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', borderRadius: 9, borderLeft: '3px solid var(--purple)' }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{m.name}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 15, fontWeight: 700, color: 'var(--purple)', textAlign: 'center' }}>{m.rieng}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 15, fontWeight: 700, color: 'var(--green)', textAlign: 'center' }}>{m.chung}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--purple-bg)', borderRadius: 8, fontSize: 11, color: 'var(--purple)', fontWeight: 600 }}>
          🤝 Giá "+ JK" áp dụng khi thuê kèm Jacket của shop
        </div>
      </div>
    </>
  )
}

function RulesSection({ customHtml }) {
  if (customHtml) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ct">📌 Quy định giao dịch</div>
        <div dangerouslySetInnerHTML={{ __html: customHtml }} />
      </div>
    )
  }
  const rules = [
    { n: '1', color: 'var(--red)', title: 'Quy định về đặt cọc', content: (
      <div style={{ paddingLeft: 30 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Khách hàng có 2 lựa chọn đặt cọc:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid var(--gold)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)', marginBottom: 3 }}>Option 1 — Cọc tiền mặt / đồ giá trị cao</div>
            <div style={{ fontSize: 12 }}>Đặt cọc <strong>100% giá trị sản phẩm</strong> + CCCD</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid var(--blue)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', marginBottom: 3 }}>Option 2 — Cọc kết hợp</div>
            <div style={{ fontSize: 12 }}>Cọc <strong>1.000.000đ</strong> + CCCD + thẻ HSSV (nếu có) + địa chỉ thường trú + SĐT</div>
          </div>
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>🗓 Shop nhận cọc slot trước tối đa <strong>3 tháng</strong></p>
      </div>
    )},
    { n: '2', color: 'var(--red)', title: 'Quy định hư hỏng', content: (
      <div style={{ paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ padding: '10px 12px', background: 'var(--gold-bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)', marginBottom: 3 }}>Defect nhẹ</div>
          <div style={{ fontSize: 12 }}>Khách thanh toán phí khắc phục. Nếu mang ra tiệm: shop cung cấp bill · Nếu shop tự xử lý: 20k–50k tùy mức độ.</div>
        </div>
        <div style={{ padding: '10px 12px', background: 'var(--red-bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)', marginBottom: 3 }}>Defect nặng</div>
          <div style={{ fontSize: 12 }}>Khách bồi thường theo giá thị trường tại thời điểm đó.</div>
        </div>
      </div>
    )},
    { n: '3', color: 'var(--red)', title: 'Quy định với sản phẩm hiếm', content: (
      <div style={{ paddingLeft: 30 }}>
        <div style={{ padding: '10px 12px', background: 'var(--red-bg)', borderRadius: 8, border: '1px solid var(--red-mid)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Áp dụng: Jacket 2024, Muffler 2024</div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>Nếu bị defect quá nặng, khách có trách nhiệm <strong>tìm sản phẩm thay thế</strong> tương đương. Shop không nhận bồi thường hoàn tiền vì đây là sản phẩm hiếm.</div>
        </div>
      </div>
    )},
    { n: '4', color: 'var(--blue)', title: 'Quy định đơn thuê xa', content: (
      <div style={{ paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['Khách thanh toán phí ship 2 chiều', 'Thời gian tính từ ngày nhận áo theo lịch đã đặt (áo tới sớm hơn không tính)', 'Kết thúc thuê tính theo ngày bạn gửi hàng trả (theo thời gian ghi nhận của đơn vị vận chuyển)'].map((t, i) =>
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.5 }}><span style={{ color: 'var(--blue)', flexShrink: 0 }}>●</span>{t}</div>
        )}
      </div>
    )},
    { n: '5', color: 'var(--green)', title: 'Khi nhận áo — kiểm tra kỹ nhé!', content: (
      <div style={{ paddingLeft: 30 }}>
        <div style={{ padding: '12px 14px', background: 'var(--green-bg)', borderRadius: 8, borderLeft: '3px solid var(--green)', fontSize: 12, lineHeight: 1.6 }}>
          📸 Shop khuyến khích bạn <strong>chụp ảnh / quay video tình trạng đồ ngay khi nhận</strong>. Shop cũng cam kết chụp ảnh/video sản phẩm trước khi gửi.
        </div>
      </div>
    )},
  ]
  return (
    <div className="card" style={{ marginBottom: 14, overflow: 'hidden', padding: 0 }}>
      <div style={{ background: 'var(--red)', padding: '14px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>📌 Quy định giao dịch</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {rules.map((r, i) => (
          <div key={r.n}>
            {i > 0 && <div style={{ height: 1, background: 'var(--line)', margin: '16px 0' }} />}
            <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: r.color, color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{r.n}</span>
              {r.title}
            </div>
            {r.content}
          </div>
        ))}
      </div>
    </div>
  )
}

function OrderCards({ orders, items }) {
  if (!orders.length) return (
    <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Chưa có đơn thuê nào</div>
      <a href="https://m.me/tiemvivu" target="_blank" rel="noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '12px 24px', borderRadius: 10, background: 'var(--red)', color: '#fff', fontWeight: 800, fontSize: 14 }}>
        💬 Liên hệ đặt thuê ngay
      </a>
    </div>
  )
  return (
    <>
      {orders.map(o => {
        const it = items.find(i => i.id === o.item_id)
        const s = SM[o.status]
        const pr = getPrice(o, items)
        const rf = (o.deposit || 0) - pr
        const sh = String(o.start_hour || 10).padStart(2, '0')
        const eh = String(o.end_hour || 10).padStart(2, '0')
        const bc = { deposit: 'var(--gold)', renting: 'var(--green)', 'ship-to': 'var(--blue)', 'ship-back': '#E65C00', done: 'var(--muted)' }[o.status] || 'var(--muted)'
        const ico = { deposit: '⏳', renting: '✅', 'ship-to': '🚚', 'ship-back': '↩️', done: '✔️' }[o.status] || '📦'
        return (
          <div key={o.id} className="cv-card" style={{ borderLeft: `4px solid ${bc}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>{it?.name || 'Đồ đã xóa'}</div>
                <span className={`badge ${s?.c || ''}`} style={{ fontSize: 12, padding: '4px 12px' }}>{ico} {s?.l || o.status}</span>
              </div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>{o.id}</div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🗓 {fmtD(o.start_date)} {sh}:00 → {fmtD(o.end_date || o.start_date)} {eh}:00</div>
              {o.type === 'xa' ? <>
                <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 3, fontWeight: 600 }}>📦 Ship{o.address ? ` đến: ${o.address}` : ''}</div>
                {o.tracking_code
                  ? <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--blue-bg)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>🚚 MVĐ: <span style={{ fontFamily: "'Space Mono',monospace" }}>{o.tracking_code}</span></div>
                  : <div style={{ marginTop: 5, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>🚚 Mã vận đơn đang cập nhật...</div>}
              </> : <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 3, fontWeight: 600 }}>🤝 Gặp trực tiếp</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--red-bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Tiền thuê</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 700, color: 'var(--red)', marginTop: 4 }}>{fmt(pr)}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--purple-bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Đã cọc</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 700, color: 'var(--purple)', marginTop: 4 }}>{o.paid_deposit > 0 ? fmt(o.paid_deposit) : '—'}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 6px', background: rf >= 0 ? 'var(--green-bg)' : '#FEE8E7', borderRadius: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{rf >= 0 ? 'Sẽ hoàn' : 'Cần thêm'}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 700, color: rf >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>{fmt(Math.abs(rf))}</div>
              </div>
            </div>
            {o.note && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '8px 10px', background: 'var(--bg)', borderRadius: 7, marginTop: 8 }}>💬 {o.note}</div>}
          </div>
        )
      })}
    </>
  )
}

function CustItemsView({ items, orders }) {
  const [calItem, setCalItem] = useState(null)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())

  return (
    <div className="cv">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>👕 Kho đồ cho thuê</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Bấm 📅 để xem lịch trống từng đồ</p>
        </div>
        <a href="https://m.me/tiemvivu" target="_blank" rel="noreferrer"
          style={{ textDecoration: 'none', padding: '10px 20px', borderRadius: 10, background: 'var(--red)', color: '#fff', fontWeight: 800, fontSize: 13 }}>
          💬 Đặt thuê ngay
        </a>
      </div>
      <div className="ig">
        {items.map(it => {
          const acc = isAcc(it)
          return (
            <div key={it.id} className={`ic${acc ? ' muf' : ''}`}>
              <div className="in">{it.name}</div>
              <span className={`ibadge${acc ? ' a' : ''}`}>{acc ? it.type : it.size}</span>
              <div className="ips">
                {acc ? <>
                  <div className="pb hi"><div className="pl">Riêng 1ng</div><div className="pv r">{fmtK(it.pr1)}</div></div>
                  <div className="pb"><div className="pl">Riêng 2ng</div><div className="pv">{fmtK(it.pr2)}</div></div>
                  <div className="pb" style={{ background: 'var(--green-bg)' }}><div className="pl">Chung 1ng</div><div className="pv" style={{ color: 'var(--green)' }}>{fmtK(it.pc1)}</div></div>
                </> : <>
                  <div className="pb hi"><div className="pl">1 ngày</div><div className="pv r">{fmtK(it.p1)}</div></div>
                  <div className="pb"><div className="pl">2 ngày</div><div className="pv">{fmtK(it.p2)}</div></div>
                  <div className="pb"><div className="pl">3+ ngày</div><div className="pv">{fmtK(it.p3)}</div></div>
                </>}
              </div>
              <button className="btn g s" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setCalItem(it.id); setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()) }}>
                📅 Xem lịch trống
              </button>
            </div>
          )
        })}
      </div>
      {calItem && <MiniCal itemId={calItem} orders={orders} year={calYear} month={calMonth} onMove={(d) => { let m = calMonth + d, y = calYear; if (m > 11) { m = 0; y++ } if (m < 0) { m = 11; y-- } setCalMonth(m); setCalYear(y) }} onClose={() => setCalItem(null)} />}
    </div>
  )
}

function MiniCal({ itemId, orders, year, month, onMove, onClose }) {
  const today = new Date()
  const first = new Date(year, month, 1).getDay()
  const dim = new Date(year, month + 1, 0).getDate()
  const off = first === 0 ? 6 : first - 1
  const title = new Date(year, month, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
  const bookedDays = {}, pendingDays = {}
  orders.filter(o => o.item_id === itemId && o.status !== 'done').forEach(o => {
    if (!o.start_date || !o.end_date) return
    const s = new Date(o.start_date + 'T12:00:00'), e = new Date(o.end_date + 'T12:00:00')
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const k = new Date(d).toISOString().slice(0, 10)
      if (o.status === 'deposit') pendingDays[k] = true; else bookedDays[k] = true
    }
  })
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ background: '#fff', borderRadius: 'var(--r)', boxShadow: 'var(--sh)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--red)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>📅 Lịch trống</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>🟢 Trống &nbsp;🔴 Đã book &nbsp;🟡 Chờ lấy</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, padding: '5px 12px', borderRadius: 7, cursor: 'pointer' }}>✕ Đóng</button>
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn g s" onClick={() => onMove(-1)}>← Trước</button>
            <span style={{ fontSize: 14, fontWeight: 800, flex: 1, textAlign: 'center' }}>{title[0].toUpperCase() + title.slice(1)}</span>
            <button className="btn g s" onClick={() => onMove(1)}>Sau →</button>
          </div>
          <div className="cg">
            {['T2','T3','T4','T5','T6','T7','CN'].map(d => <div key={d} className="cdow">{d}</div>)}
            {Array.from({ length: off }).map((_, i) => <div key={i} className="cday empty" />)}
            {Array.from({ length: dim }).map((_, i) => {
              const day = i + 1
              const d = new Date(year, month, day)
              const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isT = d.toDateString() === today.toDateString()
              const isSun = d.getDay() === 0
              const isPast = d < new Date(today.toDateString())
              let cls = 'cday'
              if (isPast) cls += ' empty'
              else if (bookedDays[k]) cls += ' booked'
              else if (pendingDays[k]) cls += ' pending'
              else cls += ' free'
              if (isT) cls += ' today'
              if (isSun) cls += ' sun'
              return (
                <div key={day} className={cls}>
                  <div className="cdn">{day}</div>
                  {!isPast && (bookedDays[k] ? <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', marginTop: 2 }}>Đã book</div>
                    : pendingDays[k] ? <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold)', marginTop: 2 }}>Chờ lấy</div>
                    : <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', marginTop: 2 }}>Trống</div>)}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SIMPLE PLACEHOLDER VIEWS for admin (full implementation would be very long) ──
function DashboardView({ orders, items }) {
  const now = new Date(), mo = now.getMonth(), yr = now.getFullYear()
  const rev = orders.filter(o => o.status === 'done' && new Date(o.end_date).getMonth() === mo && new Date(o.end_date).getFullYear() === yr).reduce((s, o) => s + getPrice(o, items), 0)
  return (
    <div>
      <div className="dg">
        <div className="sc"><div className="sl">Đang thuê</div><div className="sv">{orders.filter(o => o.status === 'renting').length}</div><div className="ss">món ở tay khách</div></div>
        <div className="sc go"><div className="sl">Chờ lấy đồ</div><div className="sv">{orders.filter(o => o.status === 'deposit').length}</div><div className="ss">đã cọc</div></div>
        <div className="sc bl"><div className="sl">Đang ship</div><div className="sv">{orders.filter(o => ['ship-to','ship-back'].includes(o.status)).length}</div><div className="ss">trên đường</div></div>
        <div className="sc gr"><div className="sl">Doanh thu tháng</div><div className="sv" style={{ fontSize: 16, marginTop: 4 }}>{fmt(rev)}</div><div className="ss">{now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</div></div>
      </div>
      <div className="card">
        <div className="ct">Đơn gần đây</div>
        {orders.slice(0, 8).map(o => {
          const it = items.find(i => i.id === o.item_id)
          const s = SM[o.status]
          const pr = getPrice(o, items)
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{o.customer_name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{it?.name || '?'} · {fmtD(o.start_date)}</div>
              </div>
              <span className={`badge ${s?.c || ''}`} style={{ fontSize: 10, flexShrink: 0 }}>{s?.l || '?'}</span>
              <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 11 }}>
                <div style={{ color: 'var(--muted)' }}>thuê {fmt(pr)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BoardView({ orders, setOrders, items, toast }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date_desc')
  const [colLimits, setColLimits] = useState({})

  const sorted = [...orders].filter(o => !search || o.customer_name?.toLowerCase().includes(search.toLowerCase()) || o.id?.toLowerCase().includes(search.toLowerCase()) || items.find(i => i.id === o.item_id)?.name?.toLowerCase().includes(search.toLowerCase()))
  const cmpFns = { date_desc: (a,b) => (b.start_date||'').localeCompare(a.start_date||''), date_asc: (a,b) => (a.start_date||'').localeCompare(b.start_date||''), created_desc: (a,b) => (b.created_at||'').localeCompare(a.created_at||''), name_asc: (a,b) => (a.customer_name||'').localeCompare(b.customer_name||'','vi') }
  sorted.sort(cmpFns[sort] || cmpFns.date_desc)

  async function updStatus(id, status) {
    try {
      await api.updateOrder({ id, status })
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    } catch (e) { toast(e.message, 'er') }
  }
  async function delOrd(id) {
    if (!confirm('Xoá đơn ' + id + '?')) return
    try {
      await api.deleteOrder(id)
      setOrders(prev => prev.filter(o => o.id !== id))
      toast('Đã xoá đơn', 'ok')
    } catch (e) { toast(e.message, 'er') }
  }

  return (
    <div>
      <div className="ph"><div className="pt">Quản lý đơn thuê</div></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, mã đơn, đồ thuê..." style={{ paddingLeft: 34, fontSize: 13, height: 38 }} />
        </div>
        <select className="inp" value={sort} onChange={e => setSort(e.target.value)} style={{ width: 'auto', fontSize: 12, fontWeight: 700, height: 38, padding: '0 10px', flexShrink: 0 }}>
          <option value="date_desc">📅 Ngày thuê: mới nhất</option>
          <option value="date_asc">📅 Ngày thuê: cũ nhất</option>
          <option value="created_desc">🕐 Tạo đơn: mới nhất</option>
          <option value="name_asc">👤 Tên A→Z</option>
        </select>
      </div>
      <div className="bw">
        {STATUSES.map(s => {
          const all = sorted.filter(o => o.status === s.k)
          const lim = colLimits[s.k] || PAGE_SIZE
          const shown = all.slice(0, lim)
          return (
            <div key={s.k} className="bc">
              <div className="bh"><span className={`badge ${s.c}`}>{s.l}</span><span className="bc-count">{all.length}</span></div>
              {shown.length === 0 && <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--muted)', fontSize: 12, fontStyle: 'italic' }}>Trống</div>}
              {shown.map(o => {
                const it = items.find(i => i.id === o.item_id)
                const pr = getPrice(o, items), dep = o.deposit || 0, rf = dep - pr
                const days = dDiff(o.start_date, o.end_date)
                return (
                  <div key={o.id} className="oc">
                    <div className="oc-stripe" style={{ background: o.type === 'xa' ? 'var(--blue)' : 'var(--red)' }} />
                    <div className="oc-body">
                      <div className="oc-top">
                        <span className="oc-id">{o.id}</span>
                        <span className="oc-days" style={{ color: isAcc(it) ? 'var(--purple)' : 'var(--green)' }}>{isAcc(it) ? 'PK' : days + ' ngày'}</span>
                      </div>
                      <div className="oc-name">{it?.name || 'Đồ đã xóa'}</div>
                      <div className="oc-cust">👤 {o.customer_name}{o.phone ? ` · ${o.phone}` : ''}</div>
                      <div className="oc-time">🗓 {fmtD(o.start_date)} → {fmtD(o.end_date || o.start_date)}</div>
                      <div className="oc-fin">
                        <div className="of" style={{ background: 'var(--red-bg)' }}><div className="of-l">Tiền thuê</div><div className="of-v" style={{ color: 'var(--red)' }}>{fmt(pr)}</div></div>
                        <div className="of" style={{ background: 'var(--gold-bg)' }}><div className="of-l">Yêu cầu cọc</div><div className="of-v" style={{ color: 'var(--gold)' }}>{fmt(dep)}</div></div>
                        <div className="of" style={{ background: o.paid_deposit > 0 ? 'var(--purple-bg)' : 'var(--bg)' }}><div className="of-l">Đã cọc</div><div className="of-v" style={{ color: o.paid_deposit > 0 ? 'var(--purple)' : 'var(--muted)' }}>{o.paid_deposit > 0 ? fmt(o.paid_deposit) : '—'}</div></div>
                        <div className="of" style={{ background: rf >= 0 ? 'var(--green-bg)' : '#FEE8E7' }}><div className="of-l">{rf >= 0 ? 'Hoàn KH' : 'Còn thiếu'}</div><div className="of-v" style={{ color: rf >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(Math.abs(rf))}</div></div>
                      </div>
                      <div className="oc-acts">
                        <select className="st-sel" value={o.status} onChange={e => updStatus(o.id, e.target.value)}>
                          {STATUSES.map(st => <option key={st.k} value={st.k}>{st.l}</option>)}
                        </select>
                        <button className="oc-act-btn del" onClick={() => delOrd(o.id)}>🗑</button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {all.length > lim && (
                <button onClick={() => setColLimits(prev => ({ ...prev, [s.k]: lim + PAGE_SIZE }))}
                  style={{ width: '100%', padding: 8, marginTop: 4, background: 'var(--bg)', border: '1px dashed var(--line)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
                  ↓ Xem thêm {Math.min(PAGE_SIZE, all.length - lim)} đơn
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalendarView({ orders, items }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const title = new Date(year, month, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
  const first = new Date(year, month, 1).getDay(), dim = new Date(year, month + 1, 0).getDate(), today = new Date()
  const off = first === 0 ? 6 : first - 1
  const evts = {}
  orders.forEach(o => {
    if (!o.start_date) return
    const s = new Date(o.start_date + 'T12:00:00'), e = new Date((o.end_date || o.start_date) + 'T12:00:00')
    const it = items.find(i => i.id === o.item_id)
    const lbl = (it?.name.split('—')[1]?.trim() || it?.name.split(' ').slice(0, 2).join(' ') || '?') + ' ' + o.customer_name.split(' ').slice(-1)[0]
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() === month && d.getFullYear() === year) {
        const k = new Date(d).toISOString().slice(0, 10)
        ;(evts[k] = evts[k] || []).push({ t: o.status === 'deposit' ? 'dep' : 'ren', l: lbl })
      }
    }
  })
  const move = d => { let m = month + d, y = year; if (m > 11) { m = 0; y++ } if (m < 0) { m = 11; y-- } setMonth(m); setYear(y) }
  return (
    <div>
      <div className="cn">
        <button className="btn g s" onClick={() => move(-1)}>← Trước</button>
        <h2>{title[0].toUpperCase() + title.slice(1)}</h2>
        <button className="btn g s" onClick={() => move(1)}>Sau →</button>
        <button className="btn g s" style={{ marginLeft: 'auto' }} onClick={() => { setMonth(new Date().getMonth()); setYear(new Date().getFullYear()) }}>Hôm nay</button>
      </div>
      <div className="cg">
        {['T2','T3','T4','T5','T6','T7','CN'].map(d => <div key={d} className="cdow">{d}</div>)}
        {Array.from({ length: off }).map((_, i) => <div key={i} className="cday empty" />)}
        {Array.from({ length: dim }).map((_, i) => {
          const day = i + 1, d = new Date(year, month, day)
          const isT = d.toDateString() === today.toDateString(), isSun = d.getDay() === 0
          const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, de = evts[k] || []
          return (
            <div key={day} className={`cday${isT ? ' today' : ''}${isSun ? ' sun' : ''}`}>
              <div className="cdn">{day}</div>
              {de.slice(0, 3).map((ev, j) => <div key={j} className={`cev ev-${ev.t}`}>{ev.l}</div>)}
              {de.length > 3 && <div className="cev" style={{ background: 'var(--line)', color: 'var(--muted)' }}>+{de.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ItemsView({ items, setItems, orders, toast }) {
  const [search, setSearch] = useState('')
  const filtered = items.filter(it => !search || it.name.toLowerCase().includes(search.toLowerCase()) || (it.size || '').toLowerCase().includes(search.toLowerCase()))
  async function del(id) {
    if (!confirm('Xoá đồ này?')) return
    try { await api.deleteItem(id); setItems(prev => prev.filter(i => i.id !== id)); toast('Đã xoá', 'ok') }
    catch (e) { toast(e.message, 'er') }
  }
  return (
    <div>
      <div className="ph"><div className="pt">Kho đồ cho thuê</div></div>
      <div style={{ marginBottom: 14, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
        <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên đồ, size, loại..." style={{ paddingLeft: 34, fontSize: 13, height: 38 }} />
      </div>
      <div className="ig">
        {filtered.map(it => {
          const acc = isAcc(it)
          return (
            <div key={it.id} className={`ic${acc ? ' muf' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div className="in">{it.name}</div>
                <span className={`ibadge${acc ? ' a' : ''}`}>{acc ? it.type : it.size}</span>
              </div>
              <div className="ips">
                {acc ? <>
                  <div className="pb hi"><div className="pl">Riêng 1ng</div><div className="pv r">{fmtK(it.pr1)}</div></div>
                  <div className="pb"><div className="pl">Riêng 2ng</div><div className="pv">{fmtK(it.pr2)}</div></div>
                </> : <>
                  <div className="pb hi"><div className="pl">1 ngày</div><div className="pv r">{fmtK(it.p1)}</div></div>
                  <div className="pb"><div className="pl">2 ngày</div><div className="pv">{fmtK(it.p2)}</div></div>
                  <div className="pb"><div className="pl">3+ ngày</div><div className="pv">{fmtK(it.p3)}</div></div>
                </>}
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button className="btn s d" onClick={() => del(it.id)} style={{ flex: 1, justifyContent: 'center' }}>🗑 Xoá</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CustomersView({ custs, setCusts, orders, toast }) {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const filtered = custs.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.id?.toLowerCase().includes(search.toLowerCase()))
  const shown = filtered.slice(0, limit)
  async function del(id) {
    if (!confirm('Xoá khách?')) return
    try { await api.deleteCustomer(id); setCusts(prev => prev.filter(c => c.id !== id)); toast('Đã xoá', 'ok') }
    catch (e) { toast(e.message, 'er') }
  }
  return (
    <div>
      <div className="ph"><div className="pt">Khách hàng</div></div>
      <div style={{ marginBottom: 14, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
        <input className="inp" value={search} onChange={e => { setSearch(e.target.value); setLimit(PAGE_SIZE) }} placeholder="Tìm tên, SĐT, mã KH..." style={{ paddingLeft: 34, fontSize: 13, height: 38 }} />
      </div>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="tw">
          <table className="dt">
            <thead><tr><th>Mã KH</th><th>Tên</th><th>Số ĐT</th><th>Loại</th><th>Đơn</th><th></th></tr></thead>
            <tbody>
              {shown.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: 'var(--muted)' }}>
                    <span style={{ fontWeight: 700 }}>{c.id}</span>
                    <button onClick={() => navigator.clipboard.writeText(c.id).then(() => toast('Đã copy mã KH', 'ok'))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '0 4px', opacity: .5 }}>📋</button>
                  </td>
                  <td style={{ fontWeight: 700 }}>{c.name}</td>
                  <td style={{ fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{c.phone || '—'}</td>
                  <td><span className={`kt ${c.type === 'xa' ? 'rem' : 'loc'}`}>{c.type === 'xa' ? 'Thuê xa' : 'GĐTT'}</span></td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: "'Space Mono',monospace" }}>{orders.filter(o => o.customer_name === c.name).length}</td>
                  <td><button className="btn s d" onClick={() => del(c.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > limit && (
            <button onClick={() => setLimit(l => l + PAGE_SIZE)} style={{ width: '100%', padding: 12, background: 'var(--bg)', border: 'none', borderTop: '1px dashed var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
              ↓ Xem thêm {Math.min(PAGE_SIZE, filtered.length - limit)} khách (còn {filtered.length - limit})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function RevenueView({ orders, items }) {
  const bm = {}
  orders.forEach(o => { const k = (o.end_date || '').slice(0, 7) || 'N/A'; if (!bm[k]) bm[k] = { n: 0, r: 0 }; bm[k].n++; bm[k].r += getPrice(o, items) })
  const mks = Object.keys(bm).sort().reverse(), tot = mks.reduce((s, k) => s + bm[k].r, 0)
  return (
    <div>
      <div className="ph"><div className="pt">Doanh thu</div></div>
      <div className="rg">
        <div className="card">
          <div className="ct">Theo tháng</div>
          <table className="rt">
            <thead><tr><th>Tháng</th><th>Đơn</th><th>Doanh thu</th></tr></thead>
            <tbody>{mks.map(k => <tr key={k}><td>{k}</td><td className="mo" style={{ textAlign: 'center' }}>{bm[k].n}</td><td className="mo">{fmt(bm[k].r)}</td></tr>)}</tbody>
            <tfoot><tr><td>Tổng</td><td className="mo" style={{ textAlign: 'center' }}>{orders.length}</td><td className="mo">{fmt(tot)}</td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function SettingsView({ settings, setSettings, toast }) {
  const [imgFile, setImgFile] = useState(null)
  const [imgUploading, setImgUploading] = useState(false)
  const [rulesHtml, setRulesHtml] = useState(settings['rules-html'] || '')

  async function uploadImg() {
    if (!imgFile) return
    setImgUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async e => {
        const base64 = e.target.result.split(',')[1]
        const { url } = await api.uploadImage(base64, imgFile.type, imgFile.name)
        setSettings(prev => ({ ...prev, 'bang-gia': url }))
        setImgFile(null)
        toast('Upload thành công!', 'ok')
        setImgUploading(false)
      }
      reader.readAsDataURL(imgFile)
    } catch (err) { toast(err.message, 'er'); setImgUploading(false) }
  }

  async function saveRules() {
    try {
      await api.saveSetting('rules-html', rulesHtml)
      setSettings(prev => ({ ...prev, 'rules-html': rulesHtml }))
      toast('Đã lưu quy định', 'ok')
    } catch (e) { toast(e.message, 'er') }
  }

  return (
    <div>
      <div className="ph"><div className="pt">⚙️ Cài đặt trang</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 960 }}>
        <div className="card">
          <div className="ct">📋 Ảnh bảng giá</div>
          {settings['bang-gia'] && <img src={settings['bang-gia']} alt="Bảng giá" style={{ width: '100%', borderRadius: 8, marginBottom: 12 }} />}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="lbl">Tải ảnh lên (JPG, PNG — tối đa 5MB)</div>
            <input type="file" accept="image/*" onChange={e => setImgFile(e.target.files?.[0])} style={{ fontSize: 13 }} />
          </label>
          {imgFile && <button className="btn p" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={uploadImg} disabled={imgUploading}>{imgUploading ? '⏳ Đang upload...' : '⬆️ Upload ảnh'}</button>}
        </div>
        <div className="card">
          <div className="ct">📌 Quy định giao dịch</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Hỗ trợ HTML. Để trống = dùng nội dung mặc định.</p>
          <textarea className="inp" value={rulesHtml} onChange={e => setRulesHtml(e.target.value)} rows={12} placeholder="Để trống = dùng quy định mặc định..." style={{ resize: 'vertical', fontSize: 13, fontFamily: 'monospace', lineHeight: 1.5 }} />
          <button className="btn p" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={saveRules}>💾 Lưu quy định</button>
        </div>
      </div>
    </div>
  )
}
