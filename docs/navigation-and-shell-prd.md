# PRD: เมนูนำทางและ Shell หน้าเว็บ (Paligo)

## เป้าหมาย

เมนูด้านซ้ายต้อง **ช่วยไปยังงานเรียนได้เร็ว** แต่ **ไม่แย่งสายตาจากเนื้อหาที่กำลังเรียน** โดยเฉพาะหน้าฝึกแปลด้วยเสียง อ่านเล่ม และทำข้อสอบ

หลักคิด: **เนื้อเรียนเป็นพระเอก — เมนูเป็นสมุดบันทึกขอบกระดาษ**

---

## สีและโทน (จาก PRD เล่มสมุด)

ใช้ token ใน `paligo-design-tokens.css` เท่านั้น ห้าม sidebar ใช้โทน dark mode หรือ accent แดงของ audio player

| Token | ค่า | ใช้กับ |
|-------|-----|--------|
| `--paligo-page-bg` | `#f8f0e3` | พื้นหลังเนื้อหาหลัก |
| `--paligo-paper-bg` | `#fffaf0` | การ์ด / top bar / fly-out |
| `--paligo-exam-blue` | `#1f2d89` | ลิงก์ active, ไอคอนเน้น, เส้นแบบสมุดข้อสอบ |
| `--paligo-ink` | `#343434` | ข้อความหลัก |
| `--sidebar-bg` | `#f0e8d6` | พื้น sidebar — เข้มกว่า page เล็กน้อย ไม่ contrast สูง |

---

## โครงเมนู (ลำดับ = ความสำคัญ)

แก้ที่ `paligo-nav-config.js` เท่านั้น — ห้ามซ้ำรายการใน HTML แต่ละหน้า

### 1. เรียนวันนี้ (priority 1)

งานเรียนหลักของผู้เรียนทุกวัน

| ชื่อเมนู | หน้า | เหตุผล |
|---------|------|--------|
| ฝึกแปลด้วยเสียง | `pali-audio-hightlight.html` | ฟัง + ไฮไลท์คำบาลี |
| อ่านหน้าเล่ม | `book-page-viewer.html` | อ่าน layout ตำรา/ข้อสอบ |

### 2. ฝึกทำข้อสอบ (priority 2)

| ชื่อเมนู | หน้า | เหตุผล |
|---------|------|--------|
| เริ่มทำข้อสอบ | `ruled-lines-card-only-template.html?newBook=1` | เริ่มรอบสอบใหม่ |
| สมุดข้อสอบของฉัน | `exam-books.html` | จัดการหลายเล่ม |

### 3. ครูและผู้ตรวจ (priority 3)

| ชื่อเมนู | หน้า |
|---------|------|
| ตรวจข้อสอบ | `exam-reviewer-console.html` |
| ตารางคะแนน | `exam-leaderboard.html` |

### 4. เตรียมเล่ม (priority 4)

สำหรับเตรียมเนื้อหา/QA — ไม่ใช่ flow เรียนประจำวัน

| ชื่อเมนู | หน้า |
|---------|------|
| ตรวจหน้าเล่ม (QA) | `book-page-qa.html` |

---

## กฎตั้งชื่อเมนู

1. ใช้ **ภาษาไทย** ตาม `docs/thai-ui-language-rules.md`
2. ใช้คำที่ผู้เรียนบาลี/ครูพูดจริง — หลีกเลี่ยงคำเทคนิคใน UI (`manifest`, `QA` ใช้ได้เฉพาะวงเล็บอธิบาย)
3. ชื่อสั้น **2–6 คำ** — อ่านได้ใน sidebar พับ 64px (tooltip)
4. ห้ามใช้ชื่อไฟล์เป็นชื่อเมนู (เช่น `pali-audio-hightlight`)
5. หน้าใหม่ต้องเพิ่มใน `PaligoNavConfig.pages` พร้อม `title` และ `section`

---

## พฤติกรรม Shell (ไม่รบกวนการเรียน)

| สถานะ | พฤติกรรม |
|-------|----------|
| ครั้งแรกเปิด | sidebar **พับ** (64px) — เน้นพื้นที่เนื้อหา |
| หน้า focusMode | แนะนำให้ผู้ใช้พับเมนูระหว่างเรียน (เอกสาร + default พับ) |
| Expanded | 260px — แสดง accordion ตามหมวด |
| Mobile | off-canvas — เนื้อหาเต็มจอจนกด hamburger |
| จำสถานะ | `localStorage` key `paligo-sidebar-collapsed-v1` |

---

## วิธีผสานหน้าใหม่

```html
<link rel="stylesheet" href="paligo-design-tokens.css" />
<link rel="stylesheet" href="sidebar-nav.css" />
<script src="paligo-nav-config.js"></script>
<script src="sidebar-nav.js"></script>
<script>
  PaligoSidebar.autoInit();
</script>
```

หรือกำหนดเอง:

```javascript
PaligoSidebar.init({
  activeHref: location.pathname,
  pageTitle: PaligoNavConfig.pageTitle(location.pathname),
});
```

---

## Checklist ก่อน merge หน้าใหม่

- [ ] มี `title` ใน `paligo-nav-config.js`
- [ ] อยู่ในหมวดที่ถูกต้อง (study / exam / review / prep)
- [ ] ใช้ `--paligo-page-bg` เป็นพื้นหลังเนื้อหา
- [ ] ไม่ใช้สี sidebar แบบ dark หรือ accent แดงของ player
- [ ] Top bar แสดงชื่อหน้าเป็นภาษาไทย ไม่ใช่ `<title>` tag ดิบ
