# Landing Page Options — paligo.jp (Phase 5.4)

**สถานะ:** ตัวอย่าง 3 แบบพร้อมดู · รอ PO ตัดสินใจ  
**ดู local:** `python3 -m http.server 8765` → [http://localhost:8765/landing/](http://localhost:8765/landing/)

---

## เป้าหมาย

| Domain | บทบาท |
|--------|--------|
| `paligo.jp` | Marketing · เปิดตัว · อธิบายแพลตฟอร์ม |
| `app.paligo.jp` | แอปเรียน (repo ปัจจุบัน) |
| `api.paligo.jp` | Inbox API |

Landing **ไม่** ใช้ sidebar เมนูเรียน — CTA ชี้ไป `app.paligo.jp` เท่านั้น

---

## ตัวอย่าง 3 แบบ

| แบบ | ไฟล์ | โทน | เหมาะกับ |
|-----|------|-----|----------|
| **A สมุดบาท** | `landing/option-a-heritage.html` | กระดาษครีม · น้ำเงินปกสมุด · Noto Serif | ผู้ปกครอง · ครูรุ่นใหญ่ · สนามหลวง |
| **B แพลตฟอร์ม** | `landing/option-b-edtech.html` | Navy gradient · สถิติ · MVP banner | เปิดตัว · Gen Z · ประกาศ “ใช้ได้แล้ว” |
| **C ชุมชน** | `landing/option-c-community.html` | เขียว-ครีม · แผนที่ตำบล | โรงเรียน · Phase B ห้องเรียน · เครือข่าย |

**หน้าเปรียบเทียบ:** `landing/index.html`

---

## เกณฑ์ตัดสินใจ (เสนอให้ทีมโหวต)

1. **ความไว้ใจ** — ผู้ใช้ใหม่รู้สึก “สนามหลวงจริง” หรือ “แอปสมัยใหม่” มากกว่า?
2. **CTA หลัก** — `เริ่มทำข้อสอบ` vs `สมัครบัญชี` vs `สมัครครู`
3. **ข้อความ hero** — เน้นสมุด / เน้นแพลตฟอร์ม / เน้นชุมชน
4. **ต่อยอด design system** — A ใกล้ `paligo-design-tokens.css` ที่สุด
5. **Deploy** — ทั้ง 3 เป็น static HTML ย้ายไป Pages project แยกได้ทันที

---

## แนวทางผสม (hybrid) ที่ทีมพิจารณาได้

| ส่วน | จากแบบ |
|------|--------|
| Hero + สีหลัก | A หรือ B |
| บล็อกฟีเจอร์ | B (grid 4 ช่อง) |
| วิสัยทัศน์ห้องเรียน | C (Phase B teaser) |
| Footer + legal | ร่วมกัน |

---

## งานหลังเลือกแบบ

- [ ] PO เลือก A / B / C หรือ hybrid
- [ ] รวบ copy จริง (ไม่ใช้ placeholder testimonial)
- [ ] โลโก้/ภาพหน้าปกสมุด (screenshot จาก app)
- [ ] Cloudflare Pages project ที่สอง → `paligo.jp` (โฟลเดอร์ `landing/` หรือ build แยก)
- [ ] Redirect rule: `www.paligo.jp` → `paligo.jp`
- [ ] OG meta + favicon

---

## Deploy แนะนำ

```text
Repo เดียว · 2 Pages projects:
  Project 1: root → app.paligo.jp
  Project 2: landing/ → paligo.jp (root directory = landing)
```

หรือ redirect ชั่วคราว: `paligo.jp` → `app.paligo.jp` จนกว่า landing จะพร้อม

---

## ช่องว่างให้ทีมเติม (brainstorm)

- ภาพ screenshot: กล่องข้อความ · หน้าปกสมุด · ผลตรวจ
- วิดีโอสั้น 30 วินาที: สร้างสมุด → ส่ง → รับผล
- หน้า `/pricing` หรือ “ฟรีสำหรับนักเรียน” (ถ้ามีนโยบาย)
- ลิงก์ LINE OA (Phase 8)
- หน้าภาษาอังกฤษ (ถ้าต้องการต่างชาติ)

---

## อ้างอิง

- `docs/deploy-cloudflare.md` §5
- `docs/agile/inbox-sprint-backlog.md` — 5.4
- `paligo-design-tokens.css`
