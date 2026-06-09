# skooldee — Backend API

REST API สำหรับระบบบริหารโรงเรียนสอนพิเศษ skooldee
**Node.js + Express + SQLite (`node:sqlite` built-in)** · JWT auth · multi-tenant

> เลือก SQLite เพื่อให้รันได้ทันทีโดยไม่ต้องตั้งฐานข้อมูลภายนอก ชั้น `src/db.js` ออกแบบให้
> สลับไป **PostgreSQL** ได้ในภายหลังโดยแทนที่โมดูลเดียว (คง `run/get/all` ไว้)

## เริ่มใช้งาน

```bash
cd server
npm install
cp .env.example .env        # แล้วแก้ JWT_SECRET
npm run reset               # สร้าง schema + ใส่ข้อมูล demo
npm start                   # http://localhost:4000
```

บัญชี demo หลัง seed: **demo@skooldee.com / demo1234** (โรงเรียน "เมโลดี้ สตูดิโอ", ข้อมูลสมมติ)

สคริปต์: `npm run migrate` (สร้าง schema) · `migrate -- --fresh` (ล้างแล้วสร้างใหม่) · `npm run seed` · `npm run reset` · `npm run dev` (auto-reload)

## สถาปัตยกรรม

```
src/
├── index.js        bootstrap + listen
├── app.js          ประกอบ route ทั้งหมด + จุดบังคับ auth
├── db.js           เชื่อม SQLite + schema (DDL) + helper run/get/all + tierOf()
├── auth.js         hash/verify password, JWT, requireAuth, requireRole
├── util.js         wrap (error handling), required (validation), helpers
├── migrate.js · seed.js
└── routes/         auth, students, teachers, packages, schedule,
                    attendance, finance, homework, points, referrals,
                    dashboard, notify
```

**Multi-tenant:** ทุก route ใต้ `/api/*` (ยกเว้น `/api/auth/*`) ต้องมี JWT — middleware ถอด
`school_id` จาก token มาเป็น `req.schoolId` และทุก query กรองด้วย `school_id` เสมอ
ข้อมูลแต่ละโรงเรียนจึงแยกขาดจากกัน (ทดสอบแล้ว)

**บทบาทผู้ใช้:** owner / admin / finance / teacher (มี `requireRole()` พร้อมใช้จำกัดสิทธิ์รายเส้นทาง)

## Endpoints

| Method | Path | หมายเหตุ |
|---|---|---|
| POST | `/api/auth/register` | สร้างโรงเรียน + บัญชี owner (สมัคร) |
| POST | `/api/auth/login` | คืน JWT |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้ + โรงเรียน |
| GET | `/api/dashboard` | KPI + แจ้งเตือนคอร์สใกล้หมด + คาบวันนี้ + สัดส่วนคลาส |
| GET/POST/PATCH/DELETE | `/api/students` | ค้นหา/กรอง `?q=&category=&near_limit=1`; `GET /:id` รวมการบ้าน+ประวัติแต้ม |
| GET/POST/PATCH/DELETE | `/api/teachers` | คำนวณค่าสอนโดยประมาณ (ชม.ต่อสัปดาห์ × เรต) |
| GET/POST/PATCH/DELETE | `/api/packages` | แพ็กเกจคอร์ส **แก้ราคาเองได้** (PATCH) |
| GET/POST/DELETE | `/api/schedule` | `?day=0..6`; รองรับคาบกลุ่ม (`is_group`,`student_ids[]`) |
| GET/POST | `/api/attendance` | `?date=`; POST `present` → **ตัดคาบ −1 + แต้ม +10 อัตโนมัติ** |
| GET/POST | `/api/finance/invoices` · `/invoices/:id/pay` · `/summary` | จ่ายแล้ว+มีแพ็กเกจ → **เติมจำนวนคาบให้** |
| GET/POST/PATCH | `/api/homework` | มอบหมาย/ติดตามสถานะ; `notify` ตั้งคิวแจ้ง LINE |
| GET/POST | `/api/points` · `/leaderboard` · `/:studentId` | กระเป๋าแต้ม + ledger + ระดับสมาชิก |
| GET/POST/PATCH | `/api/referrals` | `subscribed` → **ผู้แนะนำ +200, เพื่อน +100** |
| POST | `/api/notify/line` | **stub** ส่ง LINE (ดูวิธีเปิดใช้จริงในไฟล์ `routes/notify.js`) |

ตัวอย่าง:
```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@skooldee.com","password":"demo1234"}' | jq -r .token)
curl localhost:4000/api/dashboard -H "Authorization: Bearer $TOKEN"
```

## กฎทางธุรกิจที่ฝังไว้ (ตรงกับต้นแบบ)
- เช็คชื่อ "มาเรียน" = ตัดจำนวนครั้งคงเหลือ −1 และ +10 แต้ม
- เตือนคอร์สใกล้หมดเมื่อคงเหลือ ≤ เกณฑ์ของโรงเรียน (ตั้งค่าได้ ค่าเริ่มต้น 2)
- ระดับสมาชิก: bronze < 500 ≤ silver < 1500 ≤ gold (แต้ม)
- จ่ายบิลที่ผูกแพ็กเกจ = เติมจำนวนคาบให้นักเรียน
- แนะนำเพื่อนสำเร็จ (subscribed): ผู้แนะนำ +200, เพื่อนใหม่ +100

## งานที่เหลือก่อนขึ้น production จริง
- ย้าย SQLite → **PostgreSQL** (แทน `src/db.js`) เมื่อต้องรองรับโหลดสูง/หลายอินสแตนซ์
- เชื่อม **LINE Messaging API** จริง (ดู `routes/notify.js`) + เก็บ LINE userId ของผู้ปกครอง
- ระบบ **ชำระเงิน/subscription** ของตัว SaaS (Omise/Stripe) + webhook
- เพิ่ม rate-limiting, refresh token, audit log, การตรวจ input ที่เข้มขึ้น (เช่น zod)
- ต่อ **frontend** (`demo.html` / แอปจริง) ให้เรียก API นี้แทน localStorage
