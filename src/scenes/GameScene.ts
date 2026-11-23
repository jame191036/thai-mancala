import Phaser from 'phaser';
import { BOARD_SIZE, P1_STORE, isStore, storeOf } from '../logic/board';
import { createGame, isLegalMove, legalMoves, playMove, randomPlayer, startNextRound } from '../logic/rules';
import type { GameState, PitIndex, Player, Step } from '../logic/types';
import { LAYOUT, handPosition, slotPosition } from '../display/boardLayout';
import { COLORS, CSS, FONT, PLAYER_COLOR, PLAYER_CSS, PLAYER_NAME } from '../display/palette';
import { RULESET_NAME, SceneKeys, type GameOverData, type GameSceneData } from '../types/scenes';
import { onKeyDown } from '../input/keys';

/** One seed drop at ×1 speed (GDD §3.7). */
const BASE_DROP_MS = 120;
const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];
const SPEED_REGISTRY_KEY = 'sowSpeed';

interface SlotView {
  shape: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/**
 * The หมากขุม board with placeholder graphics (circles + seed counts).
 *
 * The rules engine (src/logic) decides everything; this scene only animates the `steps`
 * each move returns, one seed at a time, then snaps to the engine's final state so the
 * screen can never drift from the rules.
 *
 * Public fields/methods are what playtest scenarios read and drive.
 */
export class GameScene extends Phaser.Scene {
  state!: GameState;
  /** True while a move is animating (input other than "skip" is ignored). */
  busy = false;
  selectedPit: PitIndex | null = null;
  /** Pit the most recent move was sown from. */
  lastMovePit: PitIndex | null = null;
  /** Who is sowing right now (null between moves and during refills). */
  sowingPlayer: Player | null = null;
  speed: Speed = 1;
  /** Finish every animation instantly (accessibility option and fast playtests). */
  reducedMotion = false;
  /** GDD: on touch, the first tap selects a pit and a second tap on it sows. */
  touchConfirm = true;

  private slots: SlotView[] = [];
  /** What the screen currently shows (follows the steps during an animation). */
  private shown: number[] = [];
  private shownDead: boolean[] = [];
  private hoverPit: PitIndex | null = null;
  private hand!: Phaser.GameObjects.Container;
  private handLabel!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private p1Label!: Phaser.GameObjects.Text;
  private p2Label!: Phaser.GameObjects.Text;
  private roundLabel!: Phaser.GameObjects.Text;
  private messageLabel!: Phaser.GameObjects.Text;
  private speedButton!: Phaser.GameObjects.Text;
  private pending = new Set<() => void>();
  private skipRequested = false;
  private moveStartTime = -1;
  private dropsThisMove = 0;

  constructor() {
    super(SceneKeys.Game);
  }

  create(data: GameSceneData = {}): void {
    // Scene instances are reused across restarts: reset everything here.
    this.slots = [];
    this.pending = new Set();
    this.busy = false;
    this.selectedPit = null;
    this.lastMovePit = null;
    this.sowingPlayer = null;
    this.hoverPit = null;
    this.skipRequested = false;
    this.moveStartTime = -1;
    this.speed = (this.registry.get(SPEED_REGISTRY_KEY) as Speed | undefined) ?? 1;
    this.reducedMotion = this.registry.get('reducedMotion') === true;

    this.state = createGame(data.mode ?? 'short', data.firstPlayer ?? randomPlayer(), {
      maxRounds: data.maxRounds,
      ruleset: data.ruleset,
    });

    this.drawBoard();
    this.createSlots();
    this.createHud();
    this.createHand();
    this.setupInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.flushPending());

    this.renderBoard(this.state);
    this.refreshTurnUi();
    this.showBanner(`${PLAYER_NAME[this.state.current]} เริ่มก่อน`, PLAYER_CSS[this.state.current]);
  }

  // ── Public API (also used by playtests) ────────────────────────────────────

  legalPits(): PitIndex[] {
    return legalMoves(this.state);
  }

  /** Start sowing from `pit`. Returns false if the move is not allowed right now. */
  choosePit(pit: PitIndex): boolean {
    if (this.busy || !isLegalMove(this.state, pit)) return false;
    void this.runMove(pit);
    return true;
  }

  /** Numbers currently on screen, slot by slot (dead pits read as 0). */
  displayedPits(): number[] {
    return this.slots.map((s) => (s.label.text === '×' ? 0 : Number(s.label.text)));
  }

  /** Jump to the end of the current move's animation (tap anywhere / Space). */
  requestSkip(): void {
    if (!this.busy) return;
    this.skipRequested = true;
    this.tweens.killAll();
    this.flushPending();
  }

  // ── Building the screen ────────────────────────────────────────────────────

  private drawBoard(): void {
    const { board } = LAYOUT;
    this.add
      .rectangle(board.x, board.y, board.width, board.height, COLORS.woodMid)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.woodDark);
  }

  private createSlots(): void {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const { x, y } = slotPosition(i);
      if (isStore(i)) {
        const owner: Player = i === P1_STORE ? 0 : 1;
        const shape = this.add
          .rectangle(x, y, LAYOUT.store.width, LAYOUT.store.height, COLORS.pitShadow)
          .setStrokeStyle(2, PLAYER_COLOR[owner]);
        this.add
          .text(x, y - LAYOUT.store.height / 2 + 10, owner === 0 ? 'P1' : 'P2', this.textStyle(10, PLAYER_CSS[owner]))
          .setOrigin(0.5);
        const label = this.add.text(x, y, '0', this.textStyle(18, CSS.cream, true)).setOrigin(0.5);
        this.slots[i] = { shape, label };
        continue;
      }

      const shape = this.add.circle(x, y, LAYOUT.pitRadius, COLORS.pitShadow).setStrokeStyle(1, COLORS.woodLight);
      const label = this.add.text(x, y, '0', this.textStyle(12, CSS.cream, true)).setOrigin(0.5);
      this.slots[i] = { shape, label };

      const zone = this.add.zone(x, y, LAYOUT.cell.width, LAYOUT.cell.height).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPitPointer(i, p));
      zone.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return;
        this.hoverPit = i;
        this.refreshPitStyles();
      });
      zone.on('pointerout', () => {
        if (this.hoverPit !== i) return;
        this.hoverPit = null;
        this.refreshPitStyles();
      });
    }
  }

  private createHud(): void {
    this.p2Label = this.add.text(12, 14, '', this.textStyle(12, CSS.dim, true)).setOrigin(0, 0.5);
    this.roundLabel = this.add.text(240, 14, '', this.textStyle(10, CSS.dim)).setOrigin(0.5);
    this.speedButton = this.add
      .text(468, 14, '', this.textStyle(12, CSS.gold, true))
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.speedButton.on('pointerdown', () => this.cycleSpeed());

    this.banner = this.add.text(240, 45, '', this.textStyle(14, CSS.gold, true)).setOrigin(0.5).setAlpha(0);
    this.p1Label = this.add.text(12, 236, '', this.textStyle(12, CSS.dim, true)).setOrigin(0, 0.5);
    this.messageLabel = this.add.text(240, 256, '', this.textStyle(10, CSS.cream)).setOrigin(0.5);
  }

  private createHand(): void {
    const circle = this.add.circle(0, 0, 8, COLORS.gold).setStrokeStyle(1, COLORS.woodDark);
    this.handLabel = this.add.text(0, 0, '', this.textStyle(10, CSS.pitShadow, true)).setOrigin(0.5);
    this.hand = this.add.container(0, 0, [circle, this.handLabel]).setDepth(10).setVisible(false);
  }

  private setupInput(): void {
    // Gameobject and scene pointer events can arrive in either order, so the scene
    // handler ignores the very press that started the move (same downTime).
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.includes(this.speedButton)) return;
        if (this.busy) {
          if (pointer.downTime !== this.moveStartTime) this.requestSkip();
          return;
        }
        if (over.length === 0) this.clearSelection();
      },
    );

    // onKeyDown guards against Phaser 4.2.1 re-dispatching keys pressed within one frame.
    onKeyDown(this, 'LEFT', () => this.moveSelection(-1));
    onKeyDown(this, 'RIGHT', () => this.moveSelection(1));
    onKeyDown(this, 'ENTER', () => this.confirmSelection());
    onKeyDown(this, 'SPACE', () => this.confirmSelection());
    onKeyDown(this, 'ESC', () => this.clearSelection());
    onKeyDown(this, 'F', () => this.cycleSpeed());
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onPitPointer(pit: PitIndex, pointer: Phaser.Input.Pointer): void {
    if (this.busy || this.state.phase !== 'playing') return;
    if (!isLegalMove(this.state, pit)) {
      this.nudge(pit);
      return;
    }
    if (pointer.wasTouch && this.touchConfirm && this.selectedPit !== pit) {
      this.select(pit);
      return;
    }
    this.moveStartTime = pointer.downTime;
    this.choosePit(pit);
  }

  /** ← / → walk through the current player's legal pits in screen order. */
  private moveSelection(dir: 1 | -1): void {
    if (this.busy) return;
    const legal = this.legalPits().sort((a, b) => slotPosition(a).x - slotPosition(b).x);
    if (legal.length === 0) return;
    const at = this.selectedPit === null ? -1 : legal.indexOf(this.selectedPit);
    const next = at === -1 ? (dir > 0 ? 0 : legal.length - 1) : (at + dir + legal.length) % legal.length;
    this.select(legal[next]);
  }

  private confirmSelection(): void {
    if (this.busy) {
      this.requestSkip();
      return;
    }
    if (this.selectedPit !== null && isLegalMove(this.state, this.selectedPit)) this.choosePit(this.selectedPit);
    else this.moveSelection(1);
  }

  private select(pit: PitIndex): void {
    this.selectedPit = pit;
    this.refreshTurnUi();
    this.messageLabel.setText('แตะหลุมเดิมอีกครั้ง หรือกด Enter เพื่อหว่าน');
  }

  private clearSelection(): void {
    if (this.selectedPit === null) return;
    this.selectedPit = null;
    this.refreshTurnUi();
  }

  private cycleSpeed(): void {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    this.registry.set(SPEED_REGISTRY_KEY, this.speed);
    this.speedButton.setText(`×${this.speed}`);
  }

  // ── Playing a move ─────────────────────────────────────────────────────────

  private async runMove(pit: PitIndex): Promise<void> {
    this.busy = true;
    this.skipRequested = false;
    this.selectedPit = null;
    this.hoverPit = null;
    this.lastMovePit = pit;

    const before = this.state;
    this.sowingPlayer = before.current;
    const result = playMove(before, pit);
    this.state = result.state;
    this.refreshTurnUi();
    await this.animate(result.steps, before);
    this.renderBoard(this.state);

    if (this.state.phase === 'roundOver') {
      await this.wait(this.pauseMs(900));
      const roundEnded = this.state;
      const next = startNextRound(roundEnded);
      this.state = next.state;
      this.sowingPlayer = null;
      this.refreshTurnUi(); // new round number while the pits refill
      await this.animate(next.steps, roundEnded);
      this.renderBoard(this.state);
    }

    this.sowingPlayer = null;
    if (this.state.phase === 'gameOver') {
      this.finishGame();
      return;
    }
    this.busy = false;
    this.refreshTurnUi();
  }

  private async animate(steps: readonly Step[], from: GameState): Promise<void> {
    this.shown = [...from.pits];
    this.shownDead = [...from.dead];
    this.dropsThisMove = 0;
    for (const step of steps) {
      if (this.skipRequested || !this.sys.isActive()) break;
      await this.animateStep(step);
    }
    this.hand.setVisible(false);
  }

  private async animateStep(step: Step): Promise<void> {
    switch (step.kind) {
      case 'pickup':
        this.setShown(step.pit, 0);
        this.hand.setPosition(handPosition(step.pit).x, handPosition(step.pit).y).setVisible(true);
        this.handLabel.setText(String(step.seeds));
        await this.wait(this.dropMs());
        break;

      case 'drop':
        this.dropsThisMove += 1;
        await this.moveHandTo(step.pit, this.dropMs());
        this.setShown(step.pit, step.pitSeeds, true);
        this.handLabel.setText(step.handSeeds > 0 ? String(step.handSeeds) : '');
        break;

      case 'relay':
        this.setShown(step.pit, 0, true);
        this.handLabel.setText(String(step.seeds));
        this.showBanner(`หว่านต่อ ${step.seeds} เม็ด`, CSS.cream);
        await this.wait(this.dropMs() * 2);
        break;

      case 'capture': {
        this.hand.setVisible(false);
        const store = storeOf(step.player);
        this.setShown(step.opposite, 0);
        this.setShown(step.pit, 0);
        await this.flySeeds(step.opposite, store, step.toStore);
        this.setShown(store, this.shown[store] + step.toStore, true);
        this.showBanner(`กิน! +${step.toStore}`, PLAYER_CSS[step.player]);
        await this.wait(this.pauseMs(400));
        break;
      }

      case 'extraTurn':
        // No "move again" banner when the round ends right after (nothing left to play).
        // `this.state` already holds the result of the move being animated.
        if (this.state.phase !== 'playing') break;
        this.showBanner(`${PLAYER_NAME[step.player]} ได้เดินอีกตา!`, PLAYER_CSS[step.player]);
        await this.wait(this.pauseMs(600));
        break;

      case 'sideEmpty':
        this.showBanner(`หลุมฝั่ง${PLAYER_NAME[step.player]}หมด: จบรอบ`, PLAYER_CSS[step.player]);
        await this.wait(this.pauseMs(700));
        break;

      case 'sweep': {
        // Seeds left on a side go to that side owner's store (R17).
        const store = storeOf(step.player);
        this.setShown(step.pit, 0);
        await this.flySeeds(step.pit, store, step.seeds, 250);
        this.setShown(store, this.shown[store] + step.seeds, true);
        break;
      }

      case 'turnEnd':
        this.hand.setVisible(false);
        break;

      case 'pass':
        this.showBanner(`${PLAYER_NAME[step.player]} ไม่มีเม็ด ข้ามตา`, PLAYER_CSS[step.player]);
        await this.wait(this.pauseMs(800));
        break;

      case 'roundEnd':
        this.showBanner(`จบรอบ ${step.round}   ${step.stores[0]} : ${step.stores[1]}`, CSS.gold);
        await this.wait(this.pauseMs(900));
        break;

      case 'gameOver':
        break;

      case 'refill': {
        const store = storeOf(step.player);
        this.setDead(step.pit, false);
        this.setShown(store, this.shown[store] - step.seeds);
        this.setShown(step.pit, this.shown[step.pit] + step.seeds, true);
        await this.wait(this.pauseMs(60));
        break;
      }

      case 'deadPit':
        this.setDead(step.pit, true);
        await this.wait(this.pauseMs(120));
        break;

      case 'roundStart':
        this.showBanner(
          `รอบที่ ${step.round}/${this.state.maxRounds}: ${PLAYER_NAME[step.starter]} เริ่ม`,
          PLAYER_CSS[step.starter],
        );
        await this.wait(this.pauseMs(700));
        break;
    }
  }

  private finishGame(): void {
    const s = this.state;
    const data: GameOverData = {
      mode: s.mode,
      ruleset: s.ruleset,
      maxRounds: s.maxRounds,
      round: s.round,
      winner: s.winner,
      stores: s.lastRound?.stores ?? [s.pits[7], s.pits[15]],
      reason: s.endReason ?? 'singleRound',
    };
    this.refreshTurnUi();
    this.messageLabel.setText('จบเกม');
    this.time.delayedCall(this.reducedMotion ? 300 : 1600, () => this.scene.start(SceneKeys.GameOver, data));
  }

  // ── Drawing state ──────────────────────────────────────────────────────────

  /** Snap every slot to the engine's state. */
  private renderBoard(state: GameState): void {
    this.shown = [...state.pits];
    this.shownDead = [...state.dead];
    this.slots.forEach((slot, i) => {
      slot.shape.setScale(1);
      slot.label.setText(this.shownDead[i] ? '×' : String(this.shown[i]));
    });
    this.refreshPitStyles();
  }

  private setShown(index: PitIndex, seeds: number, pulse = false): void {
    this.shown[index] = seeds;
    const slot = this.slots[index];
    slot.label.setText(this.shownDead[index] ? '×' : String(seeds));
    if (pulse && !this.reducedMotion && !this.skipRequested) {
      this.tweens.killTweensOf(slot.shape);
      slot.shape.setScale(1);
      this.tweens.add({ targets: slot.shape, scale: 1.15, duration: 70, yoyo: true });
    }
  }

  private setDead(index: PitIndex, dead: boolean): void {
    this.shownDead[index] = dead;
    this.slots[index].label.setText(dead ? '×' : String(this.shown[index]));
    this.refreshPitStyles();
  }

  private refreshPitStyles(): void {
    const playing = this.state.phase === 'playing' && !this.busy;
    const legal = new Set(playing ? this.legalPits() : []);
    const cur = this.state.current;
    this.slots.forEach((slot, i) => {
      if (isStore(i) || !(slot.shape instanceof Phaser.GameObjects.Arc)) return;
      const shape = slot.shape;
      if (this.shownDead[i]) {
        shape.setFillStyle(COLORS.dead, 0.7).setStrokeStyle(1, COLORS.dead);
        slot.label.setColor(CSS.dim);
        return;
      }
      slot.label.setColor(CSS.cream);
      if (this.selectedPit === i) {
        shape.setFillStyle(COLORS.gold, 0.45).setStrokeStyle(3, COLORS.gold);
      } else if (legal.has(i)) {
        shape.setFillStyle(this.hoverPit === i ? COLORS.woodDark : COLORS.pitShadow).setStrokeStyle(2, PLAYER_COLOR[cur]);
      } else {
        shape.setFillStyle(COLORS.pitShadow).setStrokeStyle(1, COLORS.woodLight);
      }
    });
  }

  private refreshTurnUi(): void {
    const s = this.state;
    // While sowing, the engine state already points at the NEXT player; show the mover.
    const active: Player | null = this.busy ? this.sowingPlayer : s.phase === 'playing' ? s.current : null;
    const label = (p: Player) => `${active === p ? '▶ ' : ''}${PLAYER_NAME[p]}`;
    this.p1Label.setText(`${label(0)}  (แถวล่าง)`).setColor(active === 0 ? PLAYER_CSS[0] : CSS.dim);
    this.p2Label.setText(`${label(1)}  (แถวบน)`).setColor(active === 1 ? PLAYER_CSS[1] : CSS.dim);
    const mode = s.mode === 'full' ? `เกมเต็ม · รอบ ${s.round}/${s.maxRounds}` : 'เกมสั้น';
    this.roundLabel.setText(`${mode} · ${RULESET_NAME[s.ruleset]}`);
    this.speedButton.setText(`×${this.speed}`);
    this.messageLabel.setText(
      this.busy
        ? `${active === null ? '' : `${PLAYER_NAME[active]} กำลังหว่าน · `}แตะ/คลิกที่ใดก็ได้เพื่อข้าม`
        : `ตาของ${PLAYER_NAME[s.current]}: เลือกหลุมฝั่งตัวเองที่มีเม็ด`,
    );
    this.refreshPitStyles();
  }

  private showBanner(text: string, color: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1100, duration: 300 });
  }

  /** Gentle shake: that pit cannot be played. */
  private nudge(pit: PitIndex): void {
    this.messageLabel.setText('เลือกได้เฉพาะหลุมฝั่งตัวเองที่มีเม็ด');
    if (this.reducedMotion) return;
    const shape = this.slots[pit].shape;
    const x = slotPosition(pit).x;
    this.tweens.killTweensOf(shape);
    shape.setX(x);
    this.tweens.add({ targets: shape, x: x + 2, duration: 40, yoyo: true, repeat: 2, onComplete: () => shape.setX(x) });
  }

  // ── Animation helpers ──────────────────────────────────────────────────────

  /** Long relay chains speed themselves up: ×2 after 30 drops, ×4 after 60 (GDD §3.7). */
  private dropMs(): number {
    if (this.reducedMotion) return 0;
    const accel = this.dropsThisMove > 60 ? 4 : this.dropsThisMove > 30 ? 2 : 1;
    return BASE_DROP_MS / (this.speed * accel);
  }

  private pauseMs(ms: number): number {
    return this.reducedMotion ? 0 : ms / this.speed;
  }

  private moveHandTo(index: PitIndex, ms: number): Promise<void> {
    const p = handPosition(index);
    if (ms <= 0 || this.skipRequested) {
      this.hand.setPosition(p.x, p.y);
      return Promise.resolve();
    }
    return this.tweenAsync({ targets: this.hand, x: p.x, y: p.y, duration: ms, ease: 'Sine.InOut' });
  }

  /** Seeds fly from a pit into a store (captures, and leftovers at round end). */
  private async flySeeds(from: PitIndex, to: PitIndex, count: number, baseMs = 450): Promise<void> {
    const ms = this.pauseMs(baseMs);
    if (ms <= 0 || this.skipRequested) return;
    const a = slotPosition(from);
    const b = slotPosition(to);
    const blob = this.add
      .container(a.x, a.y, [
        this.add.circle(0, 0, 10, COLORS.seedLight).setStrokeStyle(1, COLORS.gold),
        this.add.text(0, 0, String(count), this.textStyle(10, CSS.cream, true)).setOrigin(0.5),
      ])
      .setDepth(11);
    await this.tweenAsync({ targets: blob, x: b.x, y: b.y, duration: ms, ease: 'Quad.InOut' });
    blob.destroy();
  }

  private wait(ms: number): Promise<void> {
    if (ms <= 0 || this.skipRequested) return Promise.resolve();
    return this.track((done) => this.time.delayedCall(ms, done));
  }

  private tweenAsync(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return this.track((done) => this.tweens.add({ ...config, onComplete: done }));
  }

  /** Promise that resolves when `done` is called OR when a skip/shutdown flushes it. */
  private track(start: (done: () => void) => void): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        if (this.pending.delete(done)) resolve();
      };
      this.pending.add(done);
      start(done);
    });
  }

  private flushPending(): void {
    for (const done of [...this.pending]) done();
  }

  private textStyle(size: number, color: string, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' };
  }
}
