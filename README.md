# หมากขุม (Mak Khum)

เกมกระดานพื้นบ้านไทย "หมากขุม" สร้างด้วย Phaser 4 + TypeScript เป็นพิกเซลอาร์ต เล่นบนเว็บได้ทั้งเดสก์ท็อปและมือถือแนวนอน

- เอกสารออกแบบเกม: [docs/GDD.md](docs/GDD.md)
- เกณฑ์ตรวจรับ: [docs/acceptance-criteria.md](docs/acceptance-criteria.md)
- บันทึกโปรเจกต์สำหรับ Claude Code: [CLAUDE.md](CLAUDE.md)

> สถานะ: เล่นได้ครบแบบ 2 คนเครื่องเดียว (เกมสั้นและเกมเต็ม) ด้วยกราฟิกชั่วคราว ยังไม่มี AI งานภาพจริง และเสียง

## ตั้งค่าเครื่องใหม่

### 1. Clone โปรเจกต์

```bat
git clone https://github.com/jame191036/thai-mancala.git
cd thai-mancala
```

### 2. ติดตั้ง Phaser 4 skills สำหรับ Claude Code

Skill ชุดนี้**ไม่ได้อยู่ใน repo** เพราะ repo ต้นทางไม่มี license จึงนำมาเผยแพร่ต่อไม่ได้ ต้องติดตั้งเองในโฟลเดอร์โปรเจกต์

```bat
npx skills add Yakoub-ai/phaser4-gamedev
```

> ⚠️ **ตอนที่คำสั่งถาม ให้เลือกดังนี้**
> - Agent: เลือก **Claude Code อย่างเดียว** ถ้าเลือกทุก agent จะได้โฟลเดอร์กระจายเกือบ 50 โฟลเดอร์ เช่น `.windsurf` และ `.kiro`
> - ขอบเขต: เลือก **Project**
> - วิธีติดตั้ง: เลือก **Copy** ไม่ใช่ Symlink
>
> ถ้ายังมีโฟลเดอร์อื่นโผล่มา เช่น `.agents/`, `skills/` หรือ `.windsurf/` ลบทิ้งได้ ไฟล์ที่ต้องใช้คือ `.claude/skills/phaser-*` เท่านั้น ดูตัวเลือกทั้งหมดได้ที่ `npx skills add --help`

### 3. ติดตั้ง codixel (skill ทำ pixel art) ระดับผู้ใช้

ติดตั้งครั้งเดียวต่อเครื่อง แล้วใช้ได้ทุกโปรเจกต์

```bat
:: cmd
git clone https://github.com/mankidev/codixel.git "%USERPROFILE%\.claude\skills\codixel"
```

```powershell
# PowerShell
git clone https://github.com/mankidev/codixel.git "$HOME\.claude\skills\codixel"
```

```bash
# Git Bash / macOS / Linux
git clone https://github.com/mankidev/codixel.git ~/.claude/skills/codixel
```

> cmd ไม่รู้จัก `~` ถ้าพิมพ์ `~/.claude/...` ใน cmd จะได้โฟลเดอร์ชื่อ `~` อยู่ในโปรเจกต์ ให้ใช้ `%USERPROFILE%` แทน

### 4. ติดตั้ง dependency และรันเกม

ต้องใช้ Node.js 20.19 ขึ้นไป

```bat
npm install
npx playwright install chromium
npm run dev
```

`npx playwright install chromium` รันครั้งเดียวต่อเครื่อง ใช้สำหรับ playtest อัตโนมัติ ส่วน `npm run dev` จะเปิด dev server ให้

| คำสั่ง | ใช้ทำ |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit tests (Vitest) |
| `npm run verify` | typecheck + unit tests + playtest บน production build ต้องผ่านก่อน commit |
| `npm run build` | build ไปที่ `dist/` |

### 5. เปิดโปรเจกต์ใน Claude Code

Claude Code อ่าน [CLAUDE.md](CLAUDE.md) อัตโนมัติ จึงรู้กติกาที่ตกลงไว้, roadmap และงานขั้นต่อไป พิมพ์ `/` แล้วควรเห็น `phaser-*` และ `codixel` ในรายการ skill
