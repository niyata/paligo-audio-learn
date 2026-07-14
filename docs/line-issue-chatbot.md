# LINE Issue Chatbot

สถานะ: portable monorepo slice สำหรับสร้าง GitHub Issue จาก LINE OA

โครงสร้าง:

```text
apps/line-issue-bot-worker/        # Cloudflare Worker app แยก deploy ได้
packages/line-issue-bot-core/      # core logic ไม่มี Paligo import
workers/src/line-issue-bot.js      # Paligo adapter ชั่วคราวเพื่อ compatibility
```

Endpoint เมื่อ deploy app แยก:

```text
POST https://chat.paligo.jp/webhook
GET  https://chat.paligo.jp/liff
```

Endpoint compatibility ใน Paligo API เดิม:

```text
POST /v1/line/issues/webhook
```

## เป้าหมาย

- ให้ PO ส่งข้อความใน LINE แล้ว bot ช่วย triage งานเป็น GitHub Issue
- รองรับหลาย repo ผ่าน allowlist `ISSUE_BOT_REPOS_JSON`
- ลดภาระจำว่า issue ไหนควรจ่ายให้ AI ตัวใด
- ปลอดภัยโดยค่าเริ่มต้น: ข้อความทั่วไปเป็น preview ก่อน, สร้างจริงเมื่อสั่ง `create` หรือใส่ `--yes`
- รองรับรูปจาก LINE: bot ดึงรูป → เก็บ R2 → ฝัง preview ใน Flex card และ GitHub issue body
- ใช้ KV เก็บ pending draft เพื่อให้ผู้ใช้กดยืนยันผ่าน Flex Message ก่อนสร้าง issue จริง

## Secrets

ตั้งผ่าน Wrangler secret, ห้ามใส่ใน source หรือ `wrangler.jsonc`

```bash
cd apps/line-issue-bot-worker
npm install
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put GITHUB_ISSUE_BOT_TOKEN
npx wrangler secret put LINE_LIFF_ID
npx wrangler secret put LINE_OA_ID
npx wrangler secret put LINE_ALLOWED_USER_IDS
```

Optional repo allowlist:

```bash
npx wrangler secret put ISSUE_BOT_REPOS_JSON
```

ตัวอย่างค่า:

```json
{
  "paligo": {
    "repo": "niyata/paligo-audio-learn",
    "board": "https://github.com/users/niyata/projects/14"
  }
}
```

ถ้าไม่ตั้ง `ISSUE_BOT_REPOS_JSON` จะใช้ alias `paligo` เป็นค่าเริ่มต้น

Optional user allowlist:

```bash
npx wrangler secret put LINE_ALLOWED_USER_IDS
```

ตัวอย่างค่าแบบ user เดียว:

```text
Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

ตัวอย่างค่าแบบหลาย user:

```text
Uxxxx,Uyyyy,Uzzzz
```

หรือ JSON array:

```json
["Uxxxx", "Uyyyy"]
```

ถ้าไม่ตั้ง `LINE_ALLOWED_USER_IDS` bot จะรับคำสั่งจาก LINE user ทุกคนที่ส่งมาถึง webhook ได้ เพื่อไม่ให้ deploy แรกพัง แต่ production ควรตั้งค่านี้ให้เหลือเฉพาะ PO/admin ที่มีสิทธิ์สร้าง issue จริง

## Local dev

```bash
cd apps/line-issue-bot-worker
npm install
npm run dev
```

Health:

```bash
curl http://127.0.0.1:8790/health
```

Production health หลัง deploy:

```bash
curl https://chat.paligo.jp/health
```

LIFF command picker:

```text
http://127.0.0.1:8790/liff
```

Production LIFF URL:

```text
https://chat.paligo.jp/liff
```

Webhook smoke แบบไม่ใช้ LINE secret ใน local:

```bash
curl -s -X POST http://127.0.0.1:8790/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"message","replyToken":"","source":{"userId":"Udev"},"message":{"type":"text","text":"/issue ทำ inbox ให้ production grade"}}]}'
```

## วิธีใช้ใน LINE

Preview:

```text
/issue ทำ inbox ให้ production grade รองรับ group workflow
```

สร้างจริง:

```text
/issue create ทำ inbox ให้ production grade รองรับ group workflow --yes
```

ระบุ repo/priority/agent/area เอง:

```text
/issue repo:paligo p:0 agent:integrator area:inbox refactor inbox naming และ compatibility route
```

เปลี่ยนโปรเจ็คหรือ repo ปลายทาง:

```text
/issue repo:<alias> p:1 agent:codex area:pipeline รายละเอียดงาน
```

ตัวอย่าง:

```text
/issue repo:paligo p:0 agent:integrator area:inbox refactor inbox naming และ compatibility route
```

พิมพ์ `repos` ใน LINE เพื่อดู alias ที่ bot รู้จักใน production ตอนนั้น

การเพิ่ม repo ใหม่ต้องเพิ่ม alias ใน secret `ISSUE_BOT_REPOS_JSON` ก่อน เช่น:

```json
{
  "paligo": {
    "repo": "niyata/paligo-audio-learn",
    "board": "https://github.com/users/niyata/projects/14"
  },
  "airdrop": {
    "repo": "niyata/airdrop-auto-move",
    "board": "https://github.com/users/niyata/projects/15"
  }
}
```

แล้วอัปโหลด secret ใหม่:

```bash
cd apps/line-issue-bot-worker
npx wrangler secret put ISSUE_BOT_REPOS_JSON
```

หรือถ้าเก็บค่าไว้ใน `.dev.vars` ของเครื่องนี้:

```bash
cd apps/line-issue-bot-worker
npx wrangler secret bulk .dev.vars
```

ข้อควรระวัง: `GITHUB_ISSUE_BOT_TOKEN` ต้องมีสิทธิ์ Issues read/write ในทุก repo ที่เพิ่มใน allowlist ไม่เช่นนั้นตอนกดยืนยันสร้าง issue จะเจอ `Resource not accessible by personal access token`

แนบรูป:

```text
1. ส่งรูป screenshot เข้า chat
2. ส่งข้อความอธิบายหรือ /issue ...
3. Bot reply Flex confirmation card พร้อม thumbnail
4. กด "ยืนยันสร้าง issue"
```

ถ้าส่งข้อความก่อนแล้วส่งรูปตาม รูปจะถูกแนบเข้า draft ล่าสุดของ LINE user คนนั้น

คำสั่งช่วย:

```text
menu    เปิด Flex menu ปุ่มลัดใน LINE
help    ดูตัวอย่างคำสั่ง
repos   ดู repo aliases ที่ bot ใช้ได้
whoami  ดู LINE userId ของตัวเอง เพื่อนำไปตั้ง allowlist
draft   แสดง draft ล่าสุดอีกครั้ง
issues  ดู issue ล่าสุดที่ bot สร้างให้ user นี้
status  เหมือน issues
cancel  ยกเลิก draft ล่าสุด
```

## Security: user allowlist

LIFF เป็นเพียงหน้าเลือกคำสั่งและส่งข้อความเข้า LINE ดังนั้นการกันสิทธิ์จริงต้องอยู่ที่ webhook โดยดู `event.source.userId`

พฤติกรรมปัจจุบัน:

- ถ้าไม่ตั้ง `LINE_ALLOWED_USER_IDS`: ทุก user ที่ส่ง event ผ่าน LINE OA ได้จะใช้ bot ได้
- ถ้าตั้ง `LINE_ALLOWED_USER_IDS`: เฉพาะ userId ใน allowlist เท่านั้นที่ใช้คำสั่งที่มีผล เช่น `/issue`, `draft`, `menu`, `issues`, postback confirm/cancel และ image draft ได้
- ถ้าตั้ง `LINE_ALLOWED_USER_IDS` แต่รูปแบบผิดหรือว่างหลัง parse: bot จะ deny คำสั่งที่มีผลไว้ก่อน เพื่อไม่ fail-open
- คำสั่ง `whoami` ยังใช้ได้เสมอ เพื่อให้ user เห็น `userId` ของตัวเองแล้วส่งให้ admin เพิ่มสิทธิ์
- หน้า `/liff` จะใช้ LIFF profile check ด้วย ถ้า `LINE_ALLOWED_USER_IDS` ถูกตั้งไว้แล้ว userId ไม่อยู่ใน allowlist หน้า console จะถูกล็อกไม่ให้ส่ง/คัดลอก/เปิด LINE

หลังรู้ userId แล้วให้อัปโหลด secret ใหม่:

```bash
cd apps/line-issue-bot-worker
npx wrangler secret put LINE_ALLOWED_USER_IDS
```

หรือถ้าเก็บไว้ใน `.dev.vars`:

```bash
cd apps/line-issue-bot-worker
npx wrangler secret bulk .dev.vars
```

## LIFF command picker

หน้า `GET /liff` เป็น mobile AI workflow console:

- แสดง workflow process: Capture → Triage → Confirm → Execute
- แสดงหน้าที่ของ AI แต่ละตัว: Integrator, Codex, Cursor, Claude, Human/PO
- มีช่อง "โจทย์ที่จะให้ AI ทำงาน" ให้แก้เฉพาะโจทย์
- มี command templates สำเร็จรูปสำหรับเลือก agent/area/priority แล้วประกอบ `/issue ...` ให้อัตโนมัติ

ปุ่มลัดหลัก 8 เมนู:

- สร้าง issue
- P0 ด่วน
- Inbox
- UX/UI
- API/Worker
- บาลี/เนื้อหา
- Draft ล่าสุด
- Issue ล่าสุด

ทุกเมนูเติมคำสั่งลง textarea ให้แก้ไขก่อนส่งเข้า LINE ได้ และยังมี preset compatibility route:

```text
/issue repo:paligo p:0 agent:integrator area:inbox refactor inbox naming และ compatibility route
```

ผู้ใช้กด preset แล้วเลือกได้ 3 ทาง:

- ส่งเข้า LINE chat ด้วย `liff.sendMessages()`
- คัดลอกคำสั่ง
- เปิด LINE OA ด้วย deep link `line.me/R/oaMessage`

ถ้าต้องการ rich menu จริงใน LINE OA ให้ผูกปุ่ม rich menu ไปที่:

- `https://chat.paligo.jp/liff` สำหรับ control panel
- message action `menu` สำหรับให้ bot ส่ง Flex menu ในแชต
- message action `issues` สำหรับดู issue ล่าสุด
- message action `draft` สำหรับเปิด draft ล่าสุด

ต้องตั้งค่า:

- `LINE_LIFF_ID` สำหรับ init LIFF
- `LINE_OA_ID` เช่น `@your_oa_id` สำหรับปุ่มเปิด LINE

## Cloudflare route: chat.paligo.jp

`apps/line-issue-bot-worker/wrangler.jsonc` ผูก Worker กับ Worker Custom Domain:

```jsonc
"routes": [
  { "pattern": "chat.paligo.jp", "custom_domain": true }
]
```

Cloudflare จะสร้าง DNS record และ certificate สำหรับ `chat.paligo.jp` ให้อัตโนมัติเมื่อ `wrangler deploy` สำเร็จ

หลัง deploy ให้ตั้งค่าใน LINE Developers:

- Messaging API Webhook URL: `https://chat.paligo.jp/webhook`
- LIFF Endpoint URL: `https://chat.paligo.jp/liff`

ก่อน deploy ต้องมี:

- zone `paligo.jp` อยู่ใน Cloudflare account
- DNS record `chat` ไม่มี CNAME/A record ทับอยู่ก่อนสร้าง Custom Domain
- secrets ครบตามหัวข้อ Secrets

## Cloudflare storage bindings

R2 bucket สำหรับรูป:

```text
line-issue-bot-assets
```

KV namespace สำหรับ pending drafts:

```text
LINE_ISSUE_DRAFTS
id: 76e28b1372ba46bd992ea8e10d19745d
```

Bindings ใน `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "LINE_ISSUE_DRAFTS", "id": "76e28b1372ba46bd992ea8e10d19745d" }
],
"r2_buckets": [
  { "binding": "LINE_ISSUE_ASSETS", "bucket_name": "line-issue-bot-assets" }
]
```

รูปที่เก็บใน R2 ถูกเสิร์ฟผ่าน Worker route:

```text
GET https://chat.paligo.jp/assets/{key}
```

GitHub issue body จะฝังรูปเป็น Markdown image URL จาก route นี้

## Flex confirmation flow

ทุก draft ที่ยังไม่สร้าง issue จะ reply เป็น Flex card:

- thumbnail รูปแรก ถ้ามี
- title / repo / labels
- summary ข้อความ
- ปุ่ม `ยืนยันสร้าง issue` → postback `confirm_issue:{draftId}`
- ปุ่ม `แก้ไขข้อความ` → message action เติม `/issue ...`
- ปุ่ม `ยกเลิก` → postback `cancel_issue:{draftId}`

## Rule-based triage

Bot จะแนะนำ labels:

- `priority:P0`, `priority:P1`, `priority:P2`
- `agent:human`, `agent:integrator`, `agent:cursor-ai`, `agent:codex-ai`, `agent:other-ai`
- `area:inbox`, `area:exam`, `area:audio`, `area:nav`, `area:docs`, `area:pipeline`

หลักคิด:

- UX/UI/Tailwind/mobile/font/modal → `agent:cursor-ai`
- API/Worker/webhook/DB/auth/logic/test → `agent:codex-ai`
- PRD/spec/copy/บาลี/ตำรา/requirements → `agent:other-ai`
- dirty tree/refactor/rename/release/cross-agent handoff → `agent:integrator`
- approve/policy/decision/payment → `agent:human`

## GitHub token scope

ใช้ Fine-grained PAT หรือ GitHub App token ที่มีสิทธิ์อย่างน้อย:

- Repository access: repo ที่อยู่ใน allowlist
- Permissions: Issues read/write

Project board automation ยังไม่อยู่ใน slice นี้ เพราะ GitHub Projects v2 ต้องใช้ GraphQL workflow เพิ่มเติม หลังจาก issue ถูกสร้างแล้วให้ใช้ label/board automation หรือเพิ่ม integration phase ถัดไป

ถ้า repo ปลายทางไม่มี labels ที่ bot แนะนำ GitHub อาจตอบ `422`; bot จะ retry สร้าง issue โดยไม่ส่ง labels และเพิ่มหัวข้อ `Suggested labels` ใน issue body แทน เพื่อไม่ให้ workflow สะดุด

## ย้ายออกเป็น project/repo แยก

ย้ายสองโฟลเดอร์นี้ไป repo ใหม่:

```text
apps/line-issue-bot-worker/
packages/line-issue-bot-core/
```

จากนั้นใน repo ใหม่สามารถเลือกทำอย่างใดอย่างหนึ่ง:

- คงโครงสร้าง monorepo เดิมไว้ แล้ว deploy จาก `apps/line-issue-bot-worker`
- ยก `packages/line-issue-bot-core/src/index.js` เข้าไปเป็น local module ใน worker app แล้วแก้ import path
- เปลี่ยนชื่อ package จาก `@paligo/*` เป็นชื่อกลาง เช่น `@line-task-bot/*`

สิ่งที่ต้องตั้งใหม่หลังย้าย:

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `GITHUB_ISSUE_BOT_TOKEN`
- `ISSUE_BOT_REPOS_JSON`
- `LINE_LIFF_ID`
- `LINE_OA_ID`

## Notes

- Production ต้องมี `LINE_CHANNEL_SECRET`; ถ้าไม่มี endpoint จะตอบ `503 line_secret_missing`
- Local/dev สามารถทดสอบ payload ได้โดยไม่ตั้ง LINE secret เมื่อเรียกผ่าน `localhost` หรือ `127.0.0.1`
- Endpoint นี้ไม่ต้องใช้ D1 จึงยังตอบได้แม้ DB binding ไม่พร้อม
