# Exam Scoring and Leaderboard Plan

## หลักการคะแนน

- คะแนนต้องนับจาก score stamp เท่านั้น ไม่กรอกคะแนนด้วยฟิลด์อิสระ
- score stamp มีค่า `1`, `2`, `3` ตรงกับ `๑ ให้`, `๒ ให้`, `๓ ให้`
- `๓ ให้` คิดเป็น 100% ของ stamp นั้น
- คะแนนรวมเริ่มต้นคิดจากค่าเฉลี่ยของ score stamps:
  - `earned = sum(scoreStamp.value)`
  - `max = scoreStamp.length * 3`
  - `percent = earned / max * 100`
- ถ้ายังไม่มี score stamp จะไม่นำผลนั้นขึ้น leaderboard

## Storage สำหรับผลตรวจ

`deliveryMethod: "line"` หมายถึงช่องทางหลักคือ LINE Flex Message ส่วน
`shareTargetPicker` เป็นกลไกเสริมของ LIFF สำหรับให้ผู้ใช้เลือกแชต/กลุ่มที่จะส่ง Flex
Message ต่อ ไม่ใช้เป็นชื่อช่องทางหลักใน UI

## User Role และ Flow ส่งตรวจ

บทบาทในระบบ:

- `student`: นักเรียน ผู้สร้างคำตอบและส่งตรวจ
- `teacher`: อาจารย์ผู้สอน รับงาน/ติดตามนักเรียน แต่ไม่จำเป็นต้องเป็นผู้ตรวจ
- `reviewer`: ผู้ตรวจ ใช้เครื่องมือ stamp และบันทึกผล
- `teacher-reviewer`: อาจารย์ผู้สอนที่ตรวจเองได้

Storage profile:

```json
"paligo-exam-student-profile-v1"
```

Submission storage:

```json
"paligo-exam-submissions-v1"
```

Reviewer profile:

```json
"paligo-exam-reviewer-profile-v1"
```

Flow ปัจจุบัน:

1. นักเรียนตั้งค่า profile และเลือกอาจารย์/บทบาทปลายทาง
2. นักเรียนกด `ส่งตรวจ` ใน `ruled-lines-card-only-template.html`
3. ระบบสร้าง `paligo.exam.submission.v1` เก็บใน `paligo-exam-submissions-v1` และดาวน์โหลดไฟล์ `.paligo-submission.json`
4. อาจารย์/ผู้ตรวจเปิด `exam-reviewer-console.html`
5. ผู้ตรวจนำเข้า submission, stamp คะแนน/ข้อผิด, แล้วกดบันทึกการตรวจ
6. ระบบสร้างผลตรวจ `paligo.exam.review.v1` ลง `paligo-exam-results-v1`
7. `exam-leaderboard.html` อ่านผลตรวจเพื่อแสดงอันดับรายวัน/สัปดาห์/สามสัปดาห์/เดือน
8. ผู้ตรวจกดส่งคืนนักเรียนเพื่อดาวน์โหลด `.paligo-review.json`

ใช้ `localStorage` key:

```json
"paligo-exam-results-v1"
```

โครงสร้างข้อมูลเป็น array:

```json
[
  {
    "id": "review-session-id",
    "studentId": "local-student-id",
    "studentName": "พระ ตัวอย่าง",
    "grade": "4",
    "profile": {
      "prefix": "พระ",
      "firstName": "ตัวอย่าง",
      "lastName": "",
      "monasticName": "สุทฺธจิตฺโต",
      "grade": "4",
      "teacherName": "อาจารย์ผู้ตรวจ",
      "deliveryMethod": "line"
    },
    "scoreStamps": [
      { "value": 3, "page": 0, "line": 4, "x": 0.62, "y": 0.31 },
      { "value": 2, "page": 0, "line": 8, "x": 0.44, "y": 0.58 }
    ],
    "errorStamps": [
      { "type": "wrong-word", "page": 0, "line": 5, "x": 0.5, "y": 0.4 },
      { "type": "wrong-relation", "page": 0, "line": 7, "x": 0.56, "y": 0.52 },
      { "type": "wrong-pa", "page": 0, "line": 9, "x": 0.6, "y": 0.66 }
    ],
    "reviewedAt": "2026-07-02T12:00:00.000Z"
  }
]
```

## Leaderboard

หน้าแยก: `exam-leaderboard.html`

ช่วงเวลาที่รองรับ:

- รายวัน: เฉพาะวันนี้
- รายสัปดาห์: วันนี้ย้อนหลัง 7 วันรวมวันนี้
- สามสัปดาห์ต่อเนื่อง: วันนี้ย้อนหลัง 21 วันรวมวันนี้
- รายเดือน: เดือนปัจจุบัน

การเรียงอันดับ:

1. เปอร์เซ็นต์สูงสุด
2. คะแนนดิบสูงสุด
3. เวลาตรวจล่าสุด

## Phase ถัดไป

- ให้ reviewer mode เขียน `scoreStamps` และ `errorStamps`
- ตอนครูกดบันทึกการตรวจ ให้ append/update รายการใน `paligo-exam-results-v1`
- ตอนส่งคืนนักเรียน ให้แนบ review package ที่มี answer hash, stamps, score summary และ reviewedAt
