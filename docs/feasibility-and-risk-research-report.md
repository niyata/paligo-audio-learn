# Feasibility and Risk Research Report

## Executive Summary

ระบบสมุดคำตอบบาลี offline-first นี้มีความเป็นไปได้สูงในเชิง prototype และ MVP เพราะสามารถทำงานด้วย static HTML/JavaScript, local storage, และ export/import package ได้โดยไม่ต้องมี account system ตั้งแต่วันแรก

ความยากของระบบไม่ได้อยู่ที่การแสดงกระดาษ แต่คือความถูกต้องของ data lifecycle:

- สมุดคำตอบหลายเล่มต้องไม่ทับกัน
- คำตอบนักเรียนต้องไม่ถูกแก้โดยผู้ตรวจ
- การส่งข้ามเครื่องต้องตรวจได้ว่าเป็นเล่ม/รอบสอบที่ถูกต้อง
- คะแนนต้องมี source of truth ที่ตรวจสอบย้อนหลังได้
- leaderboard ต้องแยก self-review กับ teacher-review ได้ในอนาคต

## Feasibility

### สิ่งที่ทำได้ทันที

- กระดาษคำตอบหลายหน้า
- autosave
- answer book grid
- export/import สมุด
- submission package
- reviewer console
- stamp-based scoring
- leaderboard จาก local results
- LINE Flex Message เป็น delivery target เชิง UI

### สิ่งที่ต้องทำก่อนใช้งานจริง

- เพิ่ม hash ตรวจคำตอบ
- เพิ่ม conflict resolver
- เพิ่ม IndexedDB เมื่อข้อมูลใหญ่
- เพิ่ม role `self-reviewer`
- เพิ่ม import review package กลับเข้าฝั่งนักเรียน
- เพิ่ม audit log ของการตรวจ
- เพิ่ม backup/restore owner identity

### สิ่งที่ยังต้องวิจัย

- เกณฑ์สนามสอบจริงของ `๑ ให้ / ๒ ให้ / ๓ ให้`
- ขนาดข้อมูลสูงสุดที่เหมาะกับ LINE delivery
- UX การส่งไฟล์ผ่าน LINE ในสถานการณ์ผู้ใช้จริง
- ความคาดหวังของครูต่อ stamp/annotation
- leaderboard ควรส่งเสริมการเรียนหรือสร้างแรงกดดันเกินไปหรือไม่

## Key Risks

### Data Corruption

ความเสี่ยง:

- localStorage เต็ม
- JSON import ผิด schema
- revision conflict
- bookId ซ้ำจาก backup
- submission/review ไม่ตรง book revision
- สร้างสมุดใหม่แล้ว fallback ไป draft เก่า
- import book id ซ้ำแล้วแทนที่ทันทีโดยไม่ถาม
- submission หลายชุดของ book เดียวกันทำให้ leaderboard ซ้ำ
- reviewer เปิด submission เดิมแล้ว stamp เดิมไม่ถูกโหลดกลับมาแก้

มาตรการ:

- schema version ทุก package
- `bookId` + `revision`
- backup ทั้งหมด
- conflict dialog
- hash package
- `newBook=1` ต้องเริ่ม draft เปล่า ไม่อ่าน legacy draft
- แยก `autosaveRevision` ออกจาก `submittedRevision`
- leaderboard ควร dedupe ด้วย `bookId + submittedRevision` หรือ policy ล่าสุดต่อเล่ม

### Privacy

ความเสี่ยง:

- ชื่อ/ฉายา/ชั้นเรียนอยู่ในไฟล์ JSON
- ส่งผิดแชต
- leaderboard เปิดเผยคะแนน
- ไฟล์ JSON อ่านได้ทันที ไม่มี encryption
- localStorage อ่านได้โดยทุก script ใน origin เดียวกัน
- import JSON จากภายนอกอาจเป็น fake score/fake reviewer

มาตรการ:

- label ข้อมูลก่อนส่ง
- optional nickname
- leaderboard scope
- export warning ก่อนส่ง
- อนาคตใช้ encryption สำหรับ package
- import preview ก่อนบันทึกจริง
- retention controls สำหรับลบข้อมูลนักเรียนจากเครื่องผู้ตรวจ

### Academic Integrity

ความเสี่ยง:

- นักเรียนแก้คำตอบหลังส่ง
- ผู้ตรวจแก้คำตอบโดยไม่ได้ตั้งใจ
- self-review ปนผลจริง
- package ถูกแก้มือก่อนส่งต่อ
- ไม่มี signed reviewer identity

มาตรการ:

- answer layer read-only ใน reviewer
- answerHash
- review result มี `isSelfReview`
- audit trail
- packageHash
- signed review หรือ server-assisted verification เมื่อเข้าสู่ห้องเรียนจริง

### UX Complexity

ความเสี่ยง:

- ผู้เรียนสับสนระหว่างสมุด/ไฟล์/submission/review
- ปุ่มเยอะเกินไป
- ภาษาเทคนิคหลุดใน UI

มาตรการ:

- ใช้คำว่า “สมุดข้อสอบ”, “ส่งตรวจ”, “ผลตรวจ”
- ซ่อนคำอย่าง schema/hash/revision จาก UI หลัก
- สรุปสถานะเล่มด้วย badge

## Recommended Roadmap

### Phase 1: Stabilize Prototype

- ทำ role `นักเรียนและผู้ตรวจตนเอง`
- เพิ่ม book status ที่ชัดเจน
- เพิ่ม import review package กลับเข้า book
- เพิ่ม answerHash แบบง่าย
- เพิ่ม conflict warning ตอน import
- ทำ submit gate ให้ freeze submitted revision ชัดเจน
- เพิ่ม preview ก่อนส่งตรวจ/ส่ง online

### Phase 2: Data Durability

- ย้ายจาก localStorage ไป IndexedDB
- เพิ่ม storage adapter กลาง
- เพิ่ม migration
- เพิ่ม backup all + restore all

### Phase 3: Delivery

- ออกแบบ LINE Flex Message UI
- เพิ่ม LIFF shareTargetPicker เป็นตัวส่งเสริม
- เพิ่ม email export
- เพิ่ม Facebook inbox guidance
- เพิ่ม delivery adapter ที่รับเฉพาะ submitted package
- ห้าม background sync draft ส่วนตัว

### Phase 4: Classroom/Admin

- classroom roster
- reviewer assignment
- teacher dashboard
- leaderboard scope
- audit log

### Phase 5: Sync Optional

- pairing token
- serverless sync
- encrypted package
- no-password flow

## AI Agent Collaboration Plan

เนื่องจากระบบนี้เป็น use case ใหม่และยังไม่มี reference ตรง ควรให้ AI agent ทำงานแบบแยกความรับผิดชอบ

### Agent Roles

- Product Flow Agent: user journey, terminology, UX simplicity
- Data Safety Agent: schema, migration, backup, conflict, privacy
- Paper Rendering Agent: ruled paper layout, line alignment, print fidelity
- Reviewer Tools Agent: stamp UX, read-only answer layer, scoring
- Delivery Agent: LINE Flex Message, email, Facebook inbox
- QA Agent: regression tests, screenshot audit, Thai language audit

### Collaboration Rules

- ห้ามแก้ไฟล์เดียวกันพร้อมกันถ้าไม่จำเป็น
- ก่อนแก้ data schema ต้องอัปเดต docs
- ทุก package ที่ส่งข้ามเครื่องต้องมี schema version
- ทุก UI text ต้องเป็นภาษาไทย
- ห้ามลบ localStorage key เดิมโดยไม่มี migration
- ห้ามเปลี่ยน scoring logic โดยไม่อัปเดต leaderboard docs
- ทุก agent ต้องรายงานไฟล์ที่แก้และ risk ที่เหลือ

## Research Questions for Team Discussion

- ระบบควรมี account จริงเมื่อไร
- ownerId offline เพียงพอสำหรับห้องเรียนจริงหรือไม่
- self-review ควรแสดง leaderboard แยกหรือไม่
- ครูต้องการตรวจบนมือถือหรือ desktop เป็นหลัก
- LINE Flex Message ควรแสดงอะไรบ้างโดยไม่ทำให้ข้อมูลส่วนตัวรั่ว
- ควรเก็บผลตรวจระยะยาวไว้ที่ไหน
