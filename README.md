# GERA — سامانه ثبت مشاهده رفتاری تسهیلگران

آفلاین‌اول (PWA)، بدون قضاوت؛ تسهیلگران رفتارهای قابل مشاهده را ثبت می‌کنند و مدیران پوشش و خروجی‌ها را می‌بینند.

- **فرانت‌اند:** React 19 + Vite + Tailwind 4، فارسی/RTL، فونت Vazirmatn (محلی)، IndexedDB برای صف آفلاین
- **بک‌اند:** Vercel Function (`api/[...path].ts`) + Neon Postgres (`@neondatabase/serverless`)
- مستندات تصمیم‌ها: [`ASSUMPTIONS.md`](ASSUMPTIONS.md) — سناریوهای آزمون: [`QA.md`](QA.md)

## استقرار روی Vercel + Neon

1. ریپو را در Vercel ایمپورت کنید (Framework: **Vite**؛ تنظیمات پیش‌فرض کافی است، `vercel.json` موجود است).
2. در Vercel → Storage → **Neon** را به پروژه وصل کنید (متغیر `DATABASE_URL` خودکار تنظیم می‌شود).
3. در Settings → Environment Variables مقدار `ADMIN_PASSWORD` (حداقل ۸ نویسه) را بگذارید؛ اختیاری: `ADMIN_USERNAME` (پیش‌فرض `admin`).
4. Deploy. در اولین درخواست، جداول ساخته می‌شوند، کاتالوگ ۲۴ رفتار بارگذاری می‌شود و مدیر سیستم ساخته می‌شود. با همان نام کاربری/رمز وارد شوید و از «تسهیلگران» حساب مدیران دوره و تسهیلگران را بسازید.

`ENABLE_DEV_TOOLS` و `VITE_ENABLE_DEV_TOOLS` را در محیط **Production** تنظیم نکنید.

## اجرا و آزمون محلی

```bash
npm install
npm test        # آزمون‌ها: منطق دامنه + API (حافظه و Postgres درون‌پردازشی)
npm run lint    # tsc --noEmit
npm run dev     # فقط فرانت‌اند (بدون /api)
```

برای اجرای کامل با API: `cp .env.example .env.local`، مقادیر را پر کنید و `npx vercel dev` را اجرا کنید.
برای داده‌ی نمونه (دوره‌ی ۶۴ نفره) روی پایگاه داده‌ی **آزمایشی** `ENABLE_DEV_TOOLS=true` و `VITE_ENABLE_DEV_TOOLS=true` بگذارید و از «پنل تست» استفاده کنید.

## ساختار

```
api/[...path].ts   ورودی تمام مسیرهای /api
server/            handler (قوانین کسب‌وکار)، store (Postgres/حافظه)، امنیت، راه‌اندازی اولیه
src/domain/        انواع و قواعد مشترک (تخصیص مؤثر، جفت‌های متضاد)
src/client/        API کلاینت + موتور آفلاین (IndexedDB، صف ارسال، همگام‌سازی)
src/ui/            صفحات تسهیلگر و پنل مدیریت
```
