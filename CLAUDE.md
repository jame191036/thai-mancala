# หมากขุม (Mak Khum) — Project Notes for Claude

เกมกระดานพื้นบ้านไทย "หมากขุม" ทำด้วย Phaser 4.2.1 + TypeScript + Vite สไตล์ pixel art 480×270 (integer scale) เล่นบนเว็บ ทั้งเดสก์ท็อปและมือถือแนวนอน

## ภาษา
- เจ้าของโปรเจกต์คุยภาษาไทย ให้ตอบเป็นภาษาไทย ศัพท์เทคนิคใช้ภาษาอังกฤษได้

## Source of truth
- **[docs/GDD.md](docs/GDD.md)**: Game Design Document ถ้าสรุปในไฟล์นี้ขัดกับ GDD **ให้ยึด GDD**
- **[docs/acceptance-criteria.md](docs/acceptance-criteria.md)**: กระดานทดสอบ F1–F16 และ checklist แยกตาม milestone
- ถ้าจะเปลี่ยนกติกาหรือสเปก ต้องถามเจ้าของก่อน แล้วแก้ GDD ก่อนแก้โค้ด และแก้สรุปในไฟล์นี้ให้ตรงกัน

## กติกา (สรุปจาก GDD §3.1 เจ้าของยืนยันทุกข้อแล้ว)
**ห้ามแทนด้วยกติกา Kalah หรือ Oware** ไม่ว่ากรณีใด

| | กติกา |
|---|---|
| กระดาน | 2 แถว แถวละ 7 หลุม และมีเรือน 2 หลุมที่หัวและท้าย เริ่ม**หลุมละ 7 เม็ด** (รวม 98 เม็ด) |
| ทิศหว่าน | **ทวนเข็มนาฬิกา** หว่านไปทางขวามือ เรือนของตัวเองอยู่ขวามือ |
| ผ่านเรือน | หยอดลงเรือนตัวเอง และ**ข้ามเรือนคู่แข่ง** |
| เม็ดสุดท้ายตกหลุมที่มีเม็ด | **หยิบทั้งหมดหว่านต่อ** ทั้งฝั่งตัวเองและฝั่งคู่แข่ง |
| เม็ดสุดท้ายตกหลุมว่างฝั่งตัวเอง | **กินหลุมตรงข้ามพร้อมเม็ดสุดท้าย**เข้าเรือน แล้วหมดตา ถ้าหลุมตรงข้ามว่าง ไม่ได้กิน เม็ดค้างไว้ และหมดตา |
| เม็ดสุดท้ายตกหลุมว่างฝั่งคู่แข่ง | หมดตา เม็ดค้างไว้ |
| เม็ดสุดท้ายตกเรือนตัวเอง | **ได้เดินอีกตา** |
| ถึงตาแล้วฝั่งตัวเองไม่มีเม็ด | **ข้ามตา** ให้อีกฝ่ายเดินต่อ จบรอบเมื่อหลุมเล็กว่างหมด ซึ่งแปลว่าทุกเม็ดอยู่ในเรือนแล้ว |
| ตาแรก | สุ่มคนเริ่ม แล้วผลัดกันเดิน |
| โหมด | เกมสั้น (1 รอบ ใครมีเม็ดในเรือนมากกว่าชนะ 49:49 เสมอ) และเกมเต็ม (หลายรอบ มีหลุมตาย) |
| เกมเต็ม | จบรอบแล้วเอาเม็ดในเรือนเติมหลุมฝั่งตัวเองหลุมละ 7 **เริ่มจากหลุมใกล้เรือน** หลุมที่เติมไม่ถึงเป็นหลุมตาย เม็ดที่เหลือน้อยกว่า 7 เก็บไว้ในเรือน ผู้แพ้รอบก่อนเดินก่อน (ถ้าเสมอ คนที่ไม่ได้เริ่มรอบก่อนเป็นคนเริ่ม) **เติมไม่ได้แม้แต่หลุมเดียวแพ้ทันที (R15)** |
| R16 จำนวนรอบ | เกมเต็มเลือกได้ **3, 5 หรือ 7 รอบ (ค่าเริ่มต้น 3)** จบรอบสุดท้ายแล้ว**ใครมีเม็ดในเรือนมากกว่าชนะ** 49:49 เสมอ ถ้า R15 เกิดพร้อมกันให้ใช้ R15 (เจ้าของเลือกเมื่อ 2026-11-23 เพราะถ้าใช้แค่ R15 สุ่มเล่นแล้วเกมไม่จบ) |
| A1–A6 | หว่านเกิน 1 รอบไม่ข้ามหลุมต้นทาง, ทั้งสองฝ่ายข้ามหลุมตายตอนหว่าน, เลือกหลุมตายไม่ได้, หลุมตรงข้ามที่เป็นหลุมตายถือว่าว่าง, หลุมตายฟื้นได้ทุกรอบ, ได้เดินอีกตาแต่ไม่มีเม็ดให้ใช้กฎข้ามตา |

**Board index** (ใช้ร่วมกันทั้ง rules engine, AI และ test)
```
         [14] [13] [12] [11] [10]  [9]  [8]     <- P2 pits
  [15]                                         [7]
 P2 store                                    P1 store
         [0]  [1]  [2]  [3]  [4]  [5]  [6]      <- P1 pits
 P1: 0..6 -> 7 -> 8..14 -> (skip 15)     P2: 8..14 -> 15 -> 0..6 -> (skip 7)
 opposite(i) = 14 - i     refill order: P1 6→0, P2 14→8     sum(pits) == 98 always
```

## Rules engine (`src/logic/`, เสร็จแล้ว M0)
- **ไฟล์:** `types.ts` (state และ Step), `board.ts` (เลขหลุม, `nextPosition`, `opposite`, `refillOrder`), `rules.ts` (กติกา) **ห้าม import Phaser** มี test ตรวจไว้ใน `tests/logic-purity.test.ts`
- **API**

  | ฟังก์ชัน | ใช้ทำ |
  |---|---|
  | `createGame(mode, firstPlayer, { maxRounds })` | เริ่มเกมใหม่ engine ไม่สุ่มเอง ผู้เรียกต้องส่งคนเริ่มมา ใช้ `randomPlayer()` ได้ `maxRounds` ใช้กับเกมเต็มเท่านั้น ตัวเลือกอยู่ใน `FULL_GAME_ROUND_OPTIONS` |
  | `createCustomState({ pits, current, mode, dead })` | สร้างกระดานทดสอบหรือ tutorial |
  | `legalMoves(state)` / `isLegalMove(state, pit)` | หลุมที่เลือกได้ |
  | `playMove(state, pit)` | เดิน 1 ตา คืน `{ state, steps }` ถ้าผิดกติกาจะ throw `IllegalMoveError` |
  | `startNextRound(state)` | เกมเต็มเท่านั้น ใช้ตอน `phase === 'roundOver'` เพื่อเติมหลุม ตั้งหลุมตาย และเลือกคนเริ่ม |
  | `state.endReason` | บอกว่าเกมจบเพราะอะไร: `singleRound` (เกมสั้น), `cannotFill` (R15), `roundLimit` (R16) |

- **`steps` คือทุกจังหวะตามลำดับ** ใช้ทำ animation ได้ทันที
  - `pickup`, ตามด้วย `drop` ทีละเม็ด (บอกจำนวนเม็ดในหลุมและในมือ), `relay`
  - `capture` หรือ `extraTurn` แล้ว `turnEnd` (บอกเหตุผล) และ `pass`
  - `roundEnd` แล้ว `gameOver`
  - `refill`, `deadPit`, `roundStart`
  - เอาทุก step ไปเล่นซ้ำบนกระดานเดิมแล้วต้องได้ `state.pits` ใหม่ทุกช่อง (`tests/helpers.ts` → `replaySteps`)
- **State ไม่ถูกแก้:** ทุกฟังก์ชันคืน object ใหม่
- **Tests:** `tests/rules.test.ts` (F1–F16 และทุกกติกา) และ `tests/rules.fuzz.test.ts` (สุ่มเล่นด้วย seed คงที่)

## สเปกงานภาพ (สรุปจาก GDD §8 และ §10)
- **ความละเอียดฐาน 480×270** ตั้ง `pixelArt: true` และ `roundPixels: true` ห้ามใช้ anti-aliasing ในงานภาพ
- **Integer scale คิดจาก device pixel:** `k = floor(min(w·dpr/480, h·dpr/270))` และ `zoom = k/dpr` อยู่ใน [src/display/integerScale.ts](src/display/integerScale.ts) ใช้ `Scale.NONE` + `setZoom` **ห้ามเปลี่ยนเป็น `Scale.FIT`** เพราะจะขยายแบบทศนิยมและพิกเซลจะไม่เท่ากัน **ไม่มีโหมด non-integer** (เจ้าของตัดสินแล้ว)
- **Palette** (ยังปรับได้ตอนทำ art)

  | Role | Hex | | Role | Hex |
  |---|---|---|---|---|
  | Background deep | `#1E1A2B` | | Seed / highlight | `#6B3B1F` / `#A8673A` |
  | Wood dark | `#5A3A22` | | Gold accent | `#E0B040` |
  | Wood mid | `#8B5A2B` | | Text cream | `#F3E9D2` |
  | Wood light | `#C08A4E` | | P1 (ล่าง) ▲ | `#3FA7B5` |
  | Pit shadow | `#3A2416` | | P2 (บน) ● | `#E07A3A` |
  | Dead pit | `#8C2F39` | | | |

- **ขนาด sprite**

  | Sprite | ขนาด |
  |---|---|
  | หลุม | 32×32 วางในช่องกว้าง 44 px (พื้นที่แตะอย่างน้อย 44×44) |
  | เรือน | 44×120 |
  | เม็ด | 6×6 มี 4 แบบ |
  | มือ | 24×24 |
  | ตัวเลข (bitmap font) | 5×7 |
  | ไอคอน UI | 16×16 |
  | ไอคอนปุ่มจอย | 12×12 วาดเป็นตำแหน่งปุ่ม ไม่ใช้โลโก้แบรนด์ |

- **Layout ตั้งต้น**
  - กรอบกระดาน x 26–454
  - เรือนอยู่ที่ x 34–78 และ x 402–446
  - ช่องหลุม 7 ช่อง × 44 px อยู่ที่ x 86–394
  - แถวบน y≈106 และแถวล่าง y≈164
  - HUD ด้านบน y 0–28 และด้านล่าง y 228–270
- **Animation**
  - หยอดเม็ดละ 120 ms ที่ ×1 มีปุ่ม ×2 และ ×4
  - หว่านต่อยาว ระบบเร่งเองเป็น ×2 หลังเม็ดที่ 30 และ ×4 หลังเม็ดที่ 60
  - แตะจอเพื่อข้ามได้
- **บรรยากาศ:** กระดานไม้สักวางบนเสื่อในศาลาไม้ยามเย็น ใช้ลายกนกที่ออกแบบใหม่เอง ไม่ลอกจากงานที่มีลิขสิทธิ์
- **Pipeline:** ใช้ skill `codixel` ทำงานจากภาพอ้างอิงจริง และให้เจ้าของตรวจทุกขั้น
- **ตัวอักษรไทย:** ยังเป็นความเสี่ยง ต้องทำ prototype ก่อนตัดสิน (GDD §10) Phaser `Text` ให้ขอบ anti-alias ส่วนตัวเลขใช้ bitmap font

## การตัดสินใจหลัก (2026-11-23)
- **v1 เป็นออฟไลน์อย่างเดียว:** 2 คนเครื่องเดียว, AI 3 ระดับ, รองรับจอย ห้ามเพิ่ม backend, ฐานข้อมูล หรือระบบบัญชีใน v1
- **v2:** ออนไลน์ระดับ (ก) ห้องเล่นด้วยรหัสเชิญ ระดับ (ข) และ (ค) เก็บไว้ทำทีหลัง (GDD Appendix D)
- มือถือแตะ 2 ครั้งเพื่อยืนยันการหว่าน บนเดสก์ท็อปคลิกครั้งเดียว
- Rules engine เป็น TypeScript ล้วนที่ไม่ import Phaser และเป็น deterministic คืนค่าเป็นรายการ event ส่วน AI อยู่ใน Web Worker
- Input ทุกแบบแปลงเป็น action กลาง ผู้เดินแต่ละตาใช้ Turn controller interface (เตรียมไว้สำหรับออนไลน์ใน v2)
- ไม่ใช้ physics (`physics: none`) การเคลื่อนไหวทั้งหมดใช้ tween

## Tech และคำสั่ง
| คำสั่ง | ใช้ทำ |
|---|---|
| `npm run dev` | dev server |
| `npm test` | Vitest (`tests/`) |
| `npm run playtest` | scenario ใน `playtest/` บน dev server |
| `npm run verify` | typecheck + test + playtest บน production build **ต้องผ่านก่อน commit** |
| `npm run build` | build ไปที่ `dist/` ถ้าเพิ่งรัน verify ต้อง build ใหม่ก่อน deploy เพราะ verify build แบบ `VITE_PLAYTEST` |

- **โครงสร้างโค้ด:**
  - `src/main.ts`: config และ integer zoom
  - `src/scenes/`: Boot → Preloader → MainMenu → Game → GameOver (ตอนนี้เป็น starter loop ของ template ใช้แทนด้วยเกมจริง)
  - `src/logic/`: logic ล้วน
  - `public/assets/`: asset ที่โหลดตอน runtime
- **`tools/playtest.mjs` แก้เพิ่มจากที่ scaffold ให้มา เพื่อให้ใช้บน Windows ได้** ถ้าอัปเดต skill แล้ว copy harness ใหม่มาทับ ต้องใส่ 2 จุดนี้กลับ
  1. ลบโค้ดสี ANSI ออกก่อนหา URL ของ server
  2. ใช้ `taskkill /T` ปิด process ทั้งชุด ไม่ให้ preview server ค้าง
- **เครื่องใหม่ต้องรัน `npx playwright install chromium` 1 ครั้ง** ก่อน playtest
- **CI:** `.github/workflows/ci.yml` รัน verify ทุกครั้งที่ push หรือเปิด PR ส่วน `deploy-pages.yml` deploy ขึ้น GitHub Pages เมื่อ push tag

## สถานะปัจจุบัน
- มี GDD v0.2 และ acceptance criteria แล้ว
- Scaffold Phaser 4 เสร็จแล้ว และ `npm run verify` ผ่าน (playtest 21/21)
- **M0 rules engine เสร็จแล้ว** (`src/logic/`) ผ่าน F1–F16, AC-R1–R19 และ fuzz test (เกมสั้นและเกมเต็มที่สุ่มเล่นจบทุกเกม)
- หน้าจอยังเป็น starter loop ของ template ยังไม่มีหน้าจอหมากขุม
- ตอน Alpha ต้องให้ AI เล่นกันเพื่อดูว่าเกมเต็ม 3 รอบใช้เวลาจริงเท่าไหร่ ถ้าจะปรับตัวเลือก 3/5/7 ต้องถามเจ้าของก่อน
- ขั้นต่อไป: Vertical Slice คือหน้าจอกระดาน + animation หว่านจาก `steps` + 2 คนเครื่องเดียว + เกมสั้น หรือให้ `phaser-architect` สร้าง `docs/ARCHITECTURE.md` ก่อน

## Skills
วิธีติดตั้งบนเครื่องใหม่อยู่ใน [README.md](README.md)

- **Phaser 4 skills** (`.claude/skills/phaser-*`, 26 ตัวจาก `Yakoub-ai/phaser4-gamedev` ดูได้ใน `skills-lock.json`)
  - ไม่ได้อยู่ใน git เพราะ repo ต้นทางไม่มี license และ repo นี้เป็น public
  - `.gitignore` กันไว้แล้ว **ห้าม commit ไฟล์เหล่านี้**
  - ถ้า skill ยังไม่มี ให้บอกเจ้าของให้ติดตั้งตาม README
- **ห้ามรัน `npx skills add` แบบเลือกทุก agent** เพราะจะสร้างโฟลเดอร์กระจายเกือบ 50 โฟลเดอร์ ให้เลือก Claude Code, Project และ Copy
- **codixel** (skill ทำ pixel art, MIT) ติดตั้ง**ระดับผู้ใช้** ไม่ได้อยู่ใน repo
