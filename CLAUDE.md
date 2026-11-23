# หมากขุม (Mak Khum) — Project Notes for Claude

เกมกระดานพื้นบ้านไทย "หมากขุม" ทำด้วย Phaser 4 + TypeScript สไตล์ pixel art 480×270 (integer scale) เล่นบนเว็บ ทั้งเดสก์ท็อปและมือถือแนวนอน

## ภาษา
- เจ้าของโปรเจกต์คุยภาษาไทย ให้ตอบเป็นภาษาไทย ศัพท์เทคนิคใช้ภาษาอังกฤษได้

## Source of truth
- **[docs/GDD.md](docs/GDD.md)**: Game Design Document ทุกการตัดสินใจอยู่ในไฟล์นี้
  - **§3.1 กติกา**: เจ้าของยืนยันทีละข้อแล้ว (R1–R15, A1–A6) **ห้ามแทนด้วยกติกา Kalah หรือ Oware** ถ้าจะเปลี่ยนกติกาต้องถามเจ้าของก่อน แล้วแก้ §3.1 ก่อนแก้โค้ด
  - **Appendix A**: คำถามที่ยังเปิดอยู่ และสิ่งที่ตัดสินแล้ว
  - **Appendix D**: roadmap ออนไลน์
- **[docs/acceptance-criteria.md](docs/acceptance-criteria.md)**: กระดานทดสอบ F1–F14 และ checklist แยกตาม milestone ใช้เป็น unit test ของ rules engine

## การตัดสินใจหลัก (2026-11-23)
- **v1 เป็นออฟไลน์อย่างเดียว:** 2 คนเครื่องเดียว, AI 3 ระดับ, รองรับจอย ห้ามเพิ่ม backend, ฐานข้อมูล หรือระบบบัญชีใน v1
- **v2:** ออนไลน์ระดับ (ก) ห้องเล่นด้วยรหัสเชิญ ระดับ (ข) และ (ค) เก็บไว้ทำทีหลัง
- มือถือต้องแตะ 2 ครั้งเพื่อยืนยันการหว่าน
- ใช้ integer scale อย่างเดียว คิดจาก device pixel ตาม GDD §10
- Rules engine เป็น TypeScript ล้วนที่ไม่ import Phaser และเป็น deterministic ส่วน AI อยู่ใน Web Worker
- Input ทั้งหมดแปลงเป็น action กลาง ผู้เดินแต่ละตาใช้ Turn controller interface (เตรียมไว้สำหรับออนไลน์ใน v2)

## สถานะปัจจุบัน
- มีเอกสาร GDD v0.2 และ acceptance criteria แล้ว แต่**ยังไม่มีโค้ดเกม**
- ขั้นต่อไป: **M0** เขียน rules engine ให้ผ่าน F1–F14 หรือใช้ `phaser-architect` สร้าง `docs/ARCHITECTURE.md` ก่อน

## Skills
วิธีติดตั้งบนเครื่องใหม่อยู่ใน [README.md](README.md)

- **Phaser 4 skills** (`.claude/skills/phaser-*`, 26 ตัวจาก `Yakoub-ai/phaser4-gamedev` ดูได้ใน `skills-lock.json`)
  - ไม่ได้อยู่ใน git เพราะ repo ต้นทางไม่มี license และ repo นี้เป็น public
  - `.gitignore` กันไว้แล้ว **ห้าม commit ไฟล์เหล่านี้**
  - ถ้า skill ยังไม่มี ให้บอกเจ้าของให้ติดตั้งตาม README
- **ห้ามรัน `npx skills add` แบบเลือกทุก agent** เพราะจะสร้างโฟลเดอร์กระจายเกือบ 50 โฟลเดอร์ ให้เลือก Claude Code, Project และ Copy
- **codixel** (skill ทำ pixel art, MIT) ติดตั้ง**ระดับผู้ใช้** ไม่ได้อยู่ใน repo
