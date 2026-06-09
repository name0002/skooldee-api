# skooldee — เว็บไซต์ & ระบบบริหารโรงเรียนสอนพิเศษ

โปรเจกต์นี้ประกอบด้วย **เว็บไซต์การตลาด (พร้อม deploy)** และ **ต้นแบบระบบ (prototype)**

---

## โครงสร้างไฟล์

```
Schooldee/
├── index.html            # หน้า Landing/ขาย (entry point)
├── signup.html           # ฟอร์มสมัครทดลองใช้ฟรี
├── contact.html          # ฟอร์มติดต่อ + ช่องทางติดต่อ
├── about.html            # เกี่ยวกับเรา / บล็อก / ร่วมงาน
├── privacy.html          # นโยบายความเป็นส่วนตัว (PDPA)
├── terms.html            # เงื่อนไขการใช้บริการ
├── demo.html    # ตัวอย่างระบบ (React prototype, ข้อมูลสมมติ)
├── favicon.svg
├── robots.txt · sitemap.xml
├── assets/
│   ├── landing.css       # ดีไซน์โทเคน + สไตล์หน้า Landing
│   ├── pages.css         # สไตล์หน้าฟอร์ม/กฎหมาย
│   ├── site.js           # config + analytics + จัดการฟอร์ม
│   └── *.jsx, styles.css # โค้ดต้นแบบระบบ (เดโม)
├── screenshots/          # ภาพประกอบ (cd-dash.jpg, cd-sched.jpg)
└── server/               # ⭐ Backend API (Node + Express + SQLite) — ดู server/README.md
```

---

## ⚙️ ต้องตั้งค่าก่อนใช้งานจริง — แก้ที่ `assets/site.js`

| ค่า | ใช้ทำอะไร | ถ้าไม่ตั้ง |
|---|---|---|
| `FORM_ENDPOINT` | ปลายทางรับข้อมูลฟอร์ม (เช่น Formspree หรือ API ของคุณ) | ฟอร์มจะ fallback ไปเปิดอีเมลแทน |
| `SALES_EMAIL` | อีเมลฝ่ายขาย (ใช้ตอน fallback) | — |
| `LINE_OA_URL` | ลิงก์ LINE Official Account | ปุ่ม LINE ชี้ไป placeholder |
| `PHONE` | เบอร์โทรในหน้า contact | — |
| `GA_ID` | Google Analytics 4 (`G-XXXX`) | analytics ปิดอยู่ |

> นอกจากนี้ยังมี placeholder ที่ต้องแก้: โดเมน `skooldee.com` ในแท็ก OG/canonical/sitemap, ข้อมูลบริษัทในหน้า `privacy.html` / `terms.html` (มาร์กไว้ด้วยพื้นเหลือง `[...]`)

---

## ✅ สถานะความพร้อม

### เว็บไซต์การตลาด — **พร้อม deploy** (หลังกรอก config ข้างบน)
- [x] หน้า Landing พร้อม SEO meta, Open Graph, JSON-LD, favicon, theme-color
- [x] ปุ่ม CTA ทุกปุ่มลิงก์ใช้งานได้ (→ signup / contact ตามแพ็กเกจ)
- [x] ฟอร์มสมัคร + ติดต่อ (validate + กัน PDPA consent + สถานะส่งสำเร็จ)
- [x] หน้านโยบายความเป็นส่วนตัว (PDPA) + เงื่อนไข + เกี่ยวกับเรา
- [x] robots.txt + sitemap.xml + Google Analytics 4 (รอใส่ ID)
- [x] รูปแก้นามสกุลให้ถูก (JPEG) + ใส่ width/height กัน layout shift + lazy-load

### ระบบหลังบ้าน (Backend API) — **มีแล้ว ✅** (ดู `server/`)
สร้าง REST API จริง (Node + Express + SQLite) ครอบคลุมโดเมนหลักทั้งหมด ทดสอบ end-to-end ผ่าน:
- [x] **JWT auth + multi-tenant** — แยกข้อมูลแต่ละโรงเรียนขาดจากกัน + บทบาทผู้ใช้ (owner/admin/finance/teacher)
- [x] CRUD: นักเรียน · ครู · แพ็กเกจ (แก้ราคาเองได้) · ตารางเรียน (คาบกลุ่ม)
- [x] เช็คชื่อ (ตัดคาบ −1 + แต้ม +10 อัตโนมัติ) · การเงิน (จ่าย→เติมคาบ) · การบ้าน · แต้ม/ระดับสมาชิก · แนะนำเพื่อน (+200/+100)
- [x] Dashboard summary + แจ้งเตือนคอร์สใกล้หมด

**เริ่มเซิร์ฟเวอร์:** `cd server && npm install && npm run reset && npm start` → `http://localhost:4000` (login: demo@skooldee.com / demo1234)

### ยังเหลือก่อน production เต็มรูปแบบ
1. **เชื่อม LINE จริง** — LINE Messaging API / LIFF (มี stub ที่ `server/src/routes/notify.js`; ฝั่ง frontend ลิงก์ `liff.line.me/...` ยังเป็น placeholder)
2. **ระบบชำระเงิน/Subscription** ของตัว SaaS — payment gateway (Omise/Stripe) + billing
3. **ต่อ frontend กับ API** — แปลง `.jsx` จาก Babel-in-browser → build จริง (Vite/Next.js) แล้วเรียก API แทน localStorage
4. **ย้าย SQLite → PostgreSQL** เมื่อโหลดสูง (แทนโมดูล `server/src/db.js` โมดูลเดียว)
5. **Onboarding + Super Admin** — flow สมัคร→ตั้งค่าโรงเรียน และหน้าคุมทุกโรงเรียน/MRR

---

## 🚀 วิธี deploy เว็บไซต์ (static)

เป็นไฟล์ static ล้วน อัปขึ้นโฮสต์ไหนก็ได้ เช่น **Netlify, Vercel, Cloudflare Pages, GitHub Pages**

- ตั้ง `index.html` เป็นหน้าแรก
- เชื่อมโดเมน แล้วแก้ `skooldee.com` ในไฟล์ให้ตรงโดเมนจริง (ถ้าจดโดเมนอื่น)

### ทดสอบในเครื่อง
```bash
python -m http.server 4178
# เปิด http://localhost:4178
```
> หน้าเดโมต้องเปิดผ่าน http server (ไม่ใช่ดับเบิลคลิก `file://`) เพราะเบราว์เซอร์บล็อกการโหลดไฟล์ `.jsx` และต้องต่ออินเทอร์เน็ต (React/Babel โหลดจาก CDN)
