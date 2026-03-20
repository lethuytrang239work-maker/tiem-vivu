# Tiệm Vivu — Next.js + Vercel

## Tại sao Next.js?
- `SUPABASE_SERVICE_KEY` nằm trên **server** (Vercel), client không thể đọc
- Mọi request DB đi qua `/api/*` — client chỉ thấy kết quả, không thấy key
- Admin password hash phía server, không có trong HTML

## Cấu trúc bảo mật
```
Client (browser)          Server (Vercel)          Supabase
     |                         |                       |
     |-- GET /api/items -----→ |-- service_role key → |
     |← [items data] --------- |← [data] ------------ |
     |                         |                       |
     |-- POST /api/auth/login → |-- check ADMIN_PW    |
     |← { JWT token } -------- |                       |
```

## Deploy lên Vercel

### 1. Push code lên GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/TEN_BAN/tiem-vivu.git
git push -u origin main
```

### 2. Import vào Vercel
1. Vào https://vercel.com → New Project
2. Import repo GitHub vừa tạo
3. Framework: **Next.js** (tự detect)

### 3. Thêm Environment Variables trong Vercel
Vào Project → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJ...service-role-key` |
| `ADMIN_PASSWORD` | mật khẩu mạnh của bạn |
| `JWT_SECRET` | chuỗi random 32+ ký tự |

> ⚠️ Lấy **Service Role Key** (không phải anon key) ở Supabase → Project Settings → API → service_role

### 4. Deploy
Vercel tự động deploy khi push lên GitHub.

## Chạy local
```bash
cp .env.example .env.local
# Điền giá trị thật vào .env.local
npm install
npm run dev
```

## SQL cần chạy trong Supabase
```sql
-- Tạo bảng settings
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz default now()
);

-- Bật RLS (service_role key bypass RLS nên vẫn hoạt động)
ALTER TABLE items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Tạo Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vivu-assets', 'vivu-assets', true)
ON CONFLICT DO NOTHING;
```

Với service_role key, **không cần tạo policy** — service_role tự động bypass RLS.
