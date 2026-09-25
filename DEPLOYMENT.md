# راهنمای استقرار دانگاتو (Dongato Deployment Guide)
## Self-Hosted Production Deployment on Linux VPS (Ubuntu)

این راهنما مراحل استقرار کامل و محیط ایزوله کانتینری پروژه **دنگاتو (Dongato)** را با استفاده از Docker و Docker Compose روی یک سرور مجازی لینوکس (مانند Ubuntu 22.04 یا 24.04 LTS) توضیح می‌دهد.

---

### معماری سامانه (System Architecture)

سامانه دنگاتو در محیط خودمیزبان (Self-Hosted) بدون وابستگی به سرویس‌های ابری از ۳ سرویس متصل در یک شبکه امن داخلی اجرا می‌شود:

1. **`dongato-db` (پایگاه داده PostgreSQL 15)**:
   - نسخه پایدار و سبک `postgres:15-alpine`
   - اسکریپت‌های اولیه مایگریشن و ایجاد جداول (`supabase/schema.sql` و `scripts/init-roles.sql`) به صورت خودکار در زمان اولین بوت اجرا می‌شوند.
   - دارای Volume اختصاصی ماندگار (`dongato_postgres_data`) برای حفظ داده‌های مالی و اعضا در صورت راه‌اندازی مجدد سرور.
   - دارای Healthcheck دوره‌ای با `pg_isready` جهت جلوگیری از راه‌اندازی زودهنگام سرویس‌های وابسته.

2. **`dongato-rest` (موتور API مبتنی بر PostgREST)**:
   - لایه سبک و فوق سریع `postgrest/postgrest:v12.0.2`
   - تبدیل خودکار جداول و ویوهای PostgreSQL به اندپوئینت‌های RESTful سازگار با کلاینت `@supabase/supabase-js`.
   - بررسی وضعیت با وابستگی مشروط (`depends_on.condition: service_healthy`) به دیتابیس.

3. **`dongato-app` (فرانت‌اند SPA و وب‌سرور Nginx)**:
   - ساخته‌شده با Multi-Stage Dockerfile (کامپایل سریع با Node.js و میزبانی فوق بهینه با `nginx:alpine`).
   - وب‌سرور Nginx ترافیک فرانت‌اند و پروکسی معکوس `/rest/v1/` به سرویس PostgREST را مدیریت می‌کند.
   - هدرهای امنیتی (X-Frame-Options, X-Content-Type-Options) و فشرده‌سازی Gzip فعال.

```
       [ Client Browser (کاربران) ]
                   │
                   ▼ (Port 3000 / 80)
┌───────────────────────────────────────────────┐
│  dongato-app (Nginx Web Server & Reverse Proxy)│
│  ├─ SPA Static Assets (React 19 + Vite)       │
│  └─ /rest/v1/ ──► (Proxy Pass)                │
└──────────────┬────────────────────────────────┘
               │ (Internal Docker Network)
               ▼
┌───────────────────────────────┐
│  dongato-rest (PostgREST API) │
└──────────────┬────────────────┘
               │ (Port 5432)
               ▼
┌───────────────────────────────┐
│  dongato-db (PostgreSQL 15)   │ ◄── Persistent Volume:
│  ├─ init-roles.sql            │     (dongato_postgres_data)
│  └─ schema.sql                │
└───────────────────────────────┘
```

---

### ۱. پیش‌نیازها (Prerequisites)

پیش از شروع، مطمئن شوید که پکیج‌های زیر روی سرور اوبونتو نصب هستند:

```bash
# بروزرسانی مخازن
sudo apt update && sudo apt upgrade -y

# نصب ابزارهای پایه
sudo apt install -y git curl ufw

# نصب Docker Engine و افزونه Docker Compose
curl -fsSL https://get.docker.com | sudo sh

# اضافه کردن کاربر جاری به گروه داکر (اختیاری جهت اجرای بدون sudo)
sudo usermod -aG docker $USER
newgrp docker

# بررسی نسخه‌های نصب‌شده
docker --version
docker compose version
```

---

### ۲. دریافت سورس‌کد و تنظیم متغیرهای محیطی

```bash
# کلون مخزن پروژه
git clone https://github.com/SirAmiRTey/Dongato.git
cd Dongato

# ایجاد فایل .env بر اساس قالب نمونه
cp .env.example .env
```

فایل `.env` را با یک ویرایشگر مانند `nano` باز کرده و مقادیر مورد نیاز را تنظیم کنید:

```bash
nano .env
```

نمونه مقادیر:

```env
# پورت سرویس روی سرور
APP_PORT=3000

# دیتابیس داخلی (نام هاست همان اسم سرویس در داکر است: db)
DB_HOST=db
DB_PORT=5432
DB_NAME=dongato
DB_USER=postgres
DB_PASSWORD=YourStrongDatabasePassword123!

# کلید رمزنگاری توکن‌های JWT (حداقل ۳۲ کاراکتر)
JWT_SECRET=super-secret-jwt-token-dongato-production-32-chars-long

# آدرس دسترسی کلاینت (آدرس IP سرور یا دامنه شما)
VITE_SUPABASE_URL=http://YOUR_SERVER_IP:3000
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWZlcmVuY2UiOiJkb25nYXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.signature
```

---

### ۳. ساخت و راه‌اندازی کانتینرها (Build & Run)

برای کامپایل فرانت‌اند و راه‌اندازی تمام سرویس‌ها در پس‌زمینه:

```bash
docker compose up -d --build
```

---

### ۴. بررسی وضعیت سلامت و لاگ‌ها (Health Verification)

برای اطمینان از سلامت کانتینرها:

```bash
# بررسی وضعیت اجرای کانتینرها
docker compose ps

# خروجی مورد انتظار:
# NAME           IMAGE                      STATUS                    PORTS
# dongato-app    dongato-app                Up (healthy)              0.0.0.0:3000->80/tcp
# dongato-db     postgres:15-alpine         Up (healthy)              5432/tcp
# dongato-rest   postgrest/postgrest:v12.0.2 Up                       3000/tcp
```

مشاهده لاگ‌های زنده:

```bash
# مشاهده لاگ تمام سرویس‌ها
docker compose logs -f

# مشاهده لاگ دیتابیس
docker compose logs -f db

# مشاهده لاگ وب‌سرور
docker compose logs -f app
```

---

### ۵. تنظیم فایروال سرور (UFW Firewall)

اگر از فایروال UFW استفاده می‌کنید، دسترسی پورت برنامه را باز کنید:

```bash
sudo ufw allow 22/tcp    # پورت SSH
sudo ufw allow 3000/tcp  # پورت دسترسی دنگاتو
sudo ufw enable
```

اکنون مرورگر خود را باز کرده و به آدرس زیر بروید:
```
http://YOUR_SERVER_IP:3000
```

---

### ۶. نگهداری و پشتیبان‌گیری از داده‌ها (Backup & Maintenance)

داده‌های مالی، کاربران و هزینه‌ها در Volume اختصاصی `dongato_postgres_data` ذخیره می‌شوند.

#### تهیه فایل پشتیبان (Dump):
```bash
docker exec -t dongato-db pg_dump -U postgres dongato > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### بازیابی فایل پشتیبان (Restore):
```bash
docker exec -i dongato-db psql -U postgres dongato < backup_file.sql
```

#### بروزرسانی به نسخه جدید:
```bash
git pull origin main
docker compose up -d --build
```

#### متوقف‌سازی سرویس‌ها:
```bash
# توقف کانتینرها بدون حذف داده‌ها
docker compose down

# توقف و حذف کامل Volumeها (داده‌ها پاک می‌شود!)
# docker compose down -v
```
