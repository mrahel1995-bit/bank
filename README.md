# النظام المالي الموحد 🏦

نظام مالي متكامل مع تسجيل دخول آمن — Express + PostgreSQL + JWT

---

## خطوات النشر (من الصفر)

### الخطوة 1 — تجهيز الملفات المحلية

```bash
# ضع ملف النظام الموحد في مجلد public
cp النظام_الموحد_v8.html public/index.html
```

### الخطوة 2 — رفع على GitHub

1. اذهب إلى [github.com](https://github.com) وأنشئ حساباً
2. انقر **New Repository**
3. اسم المشروع: `unified-system` (أو أي اسم)
4. اجعله **Private** (خاص)
5. انقر **Create Repository**
6. نفّذ هذه الأوامر في مجلد المشروع:

```bash
git init
git add .
git commit -m "النظام المالي الموحد - الإصدار الأول"
git branch -M main
git remote add origin https://github.com/اسمك/unified-system.git
git push -u origin main
```

---

### الخطوة 3 — إنشاء قاعدة بيانات على Render

1. اذهب إلى [render.com](https://render.com) وأنشئ حساباً
2. انقر **New +** → **PostgreSQL**
3. الإعدادات:
   - **Name:** `unified-db`
   - **Plan:** Free
4. انقر **Create Database**
5. **احتفظ بـ `Internal Database URL`** — ستحتاجه لاحقاً

---

### الخطوة 4 — نشر الخادم على Render

1. انقر **New +** → **Web Service**
2. اختر **Connect a repository** → اربط GitHub
3. اختر مشروعك `unified-system`
4. الإعدادات:
   - **Name:** `unified-system`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free

5. أضف **Environment Variables** (متغيرات البيئة):

| المفتاح | القيمة |
|---|---|
| `DATABASE_URL` | Internal URL من الخطوة 3 |
| `JWT_SECRET` | مفتاح عشوائي (انظر أدناه) |
| `PASSWORD` | كلمة مرورك |
| `NODE_ENV` | `production` |

**لتوليد JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

6. انقر **Create Web Service**

---

### الخطوة 5 — الدخول للنظام

بعد اكتمال النشر (دقيقتان تقريباً):

```
https://unified-system.onrender.com/login
```

أدخل كلمة المرور التي وضعتها في `PASSWORD`

---

## تشغيل محلي (للتطوير)

```bash
# تثبيت الحزم
npm install

# نسخ ملف الإعدادات
cp .env.example .env
# عدّل .env بقيمك الفعلية

# تشغيل
npm run dev
```

---

## هيكل المشروع

```
unified-system/
├── server.js          ← الخادم الرئيسي
├── package.json
├── generate-hash.js   ← أداة تشفير كلمة المرور
├── .env.example       ← نموذج الإعدادات
├── .gitignore
├── README.md
└── public/
    ├── login.html     ← صفحة الدخول
    └── index.html     ← النظام الموحد (ضعه هنا)
```

---

## نقاط API

| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/api/login` | تسجيل الدخول |
| `POST` | `/api/logout` | تسجيل الخروج |
| `GET`  | `/api/auth/status` | حالة الجلسة |
| `GET`  | `/api/transactions` | جلب الحركات |
| `POST` | `/api/transactions/batch` | إضافة حركات |
| `DELETE` | `/api/transactions` | حذف الحركات |
| `GET`  | `/api/customers` | جلب العملاء |
| `POST` | `/api/customers` | إضافة عميل |
| `GET`  | `/api/bank-identity` | السجل الدائم |
| `GET`  | `/ping` | فحص حياة الخادم |

---

## ملاحظة Render المجاني

الخطة المجانية تُوقف الخادم بعد **15 دقيقة** من عدم الاستخدام.
أول طلب بعد النوم يستغرق **30-60 ثانية**.

**الحل:** أضف خدمة ping خارجية مثل [UptimeRobot](https://uptimerobot.com) 
تفحص `/ping` كل 10 دقائق — مجانية وتُبقي الخادم مستيقظاً.
