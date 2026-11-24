import Phaser from 'phaser';
import { BOARD_SIZE, P1_STORE, isStore, otherPlayer, storeOf } from '../logic/board';
import { createGame, isLegalMove, legalMoves, playMove, randomPlayer, startNextRound } from '../logic/rules';
import type { GameState, PitIndex, Player, Step } from '../logic/types';
import { LAYOUT, countPosition, slotPosition } from '../display/boardLayout';
import { SowingHand, type HandPose } from '../display/sowingHand';
import { seedSpots } from '../display/seedLayout';
import { FLYING_FRAME, SEEDS_TEXTURE, SEED_ORIGIN, SeedPiles } from '../display/seedPiles';
import { COLORS, CSS, PLAYER_COLOR, PLAYER_CSS } from '../display/palette';
import { addPixelText, type PixelText } from '../display/pixelText';
import {
  AI_PLAYER,
  RULESET_NAME,
  SceneKeys,
  playerNames,
  type GameOverData,
  type GameSceneData,
  type Opponent,
  type PauseSceneData,
} from '../types/scenes';
import { AiClient } from '../ai/AiClient';
import type { AiLevel } from '../ai/ai';
import { onKeyDown } from '../input/keys';
import { connectedPadCount, onPadAction, onPadDisconnected, rumble, type PadAction } from '../input/gamepad';
import {
  FACING,
  REDUCED_MOTION,
  SOW_SPEED_LABEL,
  VIBRATION,
  loadFlag,
  loadBoardStyle,
  loadSowSpeed,
  loadTouchConfirm,
  nextSowSpeed,
  saveSowSpeed,
  type BoardStyle,
  type SowSpeed,
} from '../settings';
import { clearSavedGame, saveGame } from '../save';
import { addMoveToRecords, emptyGameRecords, saveFinishedGame, type GameRecords } from '../stats';

/** One seed drop at ×1 speed (GDD §3.7). */
const BASE_DROP_MS = 120;
/** Minimum time the AI appears to think (GDD §6), so its moves are readable. */
const AI_THINK_MS: Record<AiLevel, number> = { easy: 750, medium: 650, hard: 350 };

interface SlotView {
  /** Ring drawn over the bowl: whose turn it is, hover, selection, dead. */
  shape: Phaser.GameObjects.Arc;
  label: PixelText;
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
  /** Sowing speed (settings: ช้ามาก 0.25 … เร็วมาก 4). */
  speed: SowSpeed = 1;
  /** Finish every animation instantly (accessibility option and fast playtests). */
  reducedMotion = false;
  /** GDD: on touch, the first tap selects a pit and a second tap on it sows. */
  touchConfirm = true;
  /** Who plays P2: a second person or the AI. */
  opponent: Opponent = 'human';
  /** True while waiting for the AI to pick a pit. */
  aiThinking = false;
  /** Moves the AI has made this game. */
  aiMoves = 0;
  /** Biggest capture / longest relay chain so far this game (result screen, stats). */
  records: GameRecords = emptyGameRecords();
  /** Settings: rumble on captures; P2's names and numbers upside down (2 players). */
  vibration = true;
  facing = false;
  /** Settings: marbles, marbles with a hand, or numbers. */
  boardStyle: BoardStyle = 'marbles';
  /** Captures that asked for a rumble (read by playtests). */
  buzzCount = 0;
  /** Scene-clock time each seed of the current move landed (AC-UI3 timing). */
  dropTimes: number[] = [];

  private slots: SlotView[] = [];
  private piles!: SeedPiles;
  /** What the screen currently shows (follows the steps during an animation). */
  private shown: number[] = [];
  private shownDead: boolean[] = [];
  private hoverPit: PitIndex | null = null;
  private hand!: SowingHand;
  private banner!: PixelText;
  private p1Label!: PixelText;
  private p2Label!: PixelText;
  private roundLabel!: PixelText;
  private messageLabel!: PixelText;
  private speedButton!: PixelText;
  private pauseButton!: PixelText;
  /** Set once the game is over, so the pause menu can no longer open. */
  private finished = false;
  private pending = new Set<() => void>();
  private skipRequested = false;
  private moveStartTime = -1;
  private dropsThisMove = 0;
  private names: readonly [string, string] = ['', ''];
  private ai: AiClient | null = null;
  /** Bumped on every new game/shutdown so a late AI answer is ignored. */
  private aiToken = 0;
  /** When the next seed is due (keeps a steady rhythm, see beat()). */
  private nextBeatAt: number | null = null;
  /** The last person to touch the board used a touch screen (phone buzz on captures). */
  private lastInputTouch = false;

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
    this.speed = loadSowSpeed(this.registry);
    this.reducedMotion = loadFlag(this.registry, REDUCED_MOTION);
    this.touchConfirm = loadTouchConfirm(this.registry) === 'double';
    this.vibration = loadFlag(this.registry, VIBRATION);
    this.boardStyle = loadBoardStyle(this.registry);
    this.buzzCount = 0;
    this.dropTimes = [];
    this.nextBeatAt = null;
    this.lastInputTouch = false;
    this.finished = false;
    this.opponent = data.resume?.opponent ?? data.opponent ?? 'human';
    this.facing = this.opponent === 'human' && loadFlag(this.registry, FACING);
    this.records = data.resume?.records ?? emptyGameRecords();
    this.names = playerNames(this.opponent);
    this.aiThinking = false;
    this.aiMoves = 0;
    this.aiToken += 1;
    this.ai?.destroy();
    this.ai = this.opponent === 'human' ? null : new AiClient();

    // A saved game continues exactly where it was; otherwise a new game replaces any save.
    this.state =
      data.resume?.state ??
      createGame(data.mode ?? 'short', data.firstPlayer ?? randomPlayer(), {
        maxRounds: data.maxRounds,
        ruleset: data.ruleset,
      });
    this.saveProgress(this.state);

    this.drawBoard();
    this.createSlots();
    this.createHud();
    this.createHand();
    this.setupInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.flushPending();
      this.aiToken += 1;
      this.ai?.destroy();
      this.ai = null;
    });

    this.renderBoard(this.state);
    this.refreshTurnUi();
    this.showBanner(
      data.resume ? 'เล่นต่อจากที่บันทึกไว้' : `${this.names[this.state.current]} เริ่มก่อน`,
      PLAYER_CSS[this.state.current],
    );
    this.maybePlayAi();
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

  /** True when the AI runs in a Web Worker (false = main-thread fallback or no AI). */
  get aiInWorker(): boolean {
    return this.ai?.usesWorker ?? false;
  }

  /** Is it the AI's turn to pick a pit? (Human input is ignored then.) */
  isAiTurn(): boolean {
    return this.opponent !== 'human' && this.state.phase === 'playing' && this.state.current === AI_PLAYER;
  }

  /** Numbers currently on screen, slot by slot (dead pits read as 0). */
  displayedPits(): number[] {
    return this.slots.map((s) => (s.label.text === '×' ? 0 : Number(s.label.text)));
  }

  /** Which slots are drawn as dead pits right now (compare with `state.dead`). */
  displayedDead(): boolean[] {
    return this.slots.map((s) => s.label.text === '×');
  }

  /** Marbles drawn in each slot (a very full slot shows fewer than its number). */
  displayedSeeds(): number[] {
    return this.slots.map((_, i) => this.piles.count(i));
  }

  /** The sowing hand right now (read by playtests): shown or not, whose, and its pose. */
  handState(): { visible: boolean; player: Player; pose: HandPose } {
    return { visible: this.hand.body.visible, player: this.hand.player, pose: this.hand.pose };
  }

  /** Every count is written inside its own bowl (seeds shown as numbers). */
  countsInBowls(): boolean {
    return this.slots.every((s) => s.label.x === s.shape.x && s.label.y === s.shape.y);
  }

  /** P2's name label is drawn upside down ("หันหน้าเข้าหากัน"). */
  get p2UpsideDown(): boolean {
    return this.p2Label.rotation !== 0;
  }

  /** Jump to the end of the current move's animation (tap anywhere / Space). */
  requestSkip(): void {
    if (!this.busy) return;
    this.skipRequested = true;
    this.tweens.killAll();
    this.flushPending();
  }

  // ── Pause menu & saving (called by PauseScene) ─────────────────────────────

  /** Open the pause menu: this scene (tweens, timers, the AI's pending move) freezes. */
  /** `padLost`: opened because a gamepad was unplugged (GDD §3.8.1, AC-G5). */
  openPause(padLost = false): void {
    if (this.finished || !this.scene.isActive()) return;
    this.scene.pause();
    const data: PauseSceneData = { padLost };
    this.scene.launch(SceneKeys.Pause, data);
  }

  resumeFromPause(): void {
    this.scene.stop(SceneKeys.Pause);
    this.scene.resume();
  }

  /** Same settings, fresh board. */
  restartGame(): void {
    const s = this.state;
    this.scene.stop(SceneKeys.Pause);
    this.scene.start(SceneKeys.Game, { mode: s.mode, maxRounds: s.maxRounds, ruleset: s.ruleset, opponent: this.opponent });
  }

  /** Give up: against the AI it is you (P1); between two people, whoever's turn it is. */
  resign(): void {
    const s = this.state;
    const loser: Player = this.opponent === 'human' ? s.current : 0;
    const data: GameOverData = {
      mode: s.mode,
      ruleset: s.ruleset,
      opponent: this.opponent,
      maxRounds: s.maxRounds,
      round: s.round,
      winner: otherPlayer(loser),
      stores: [s.pits[7], s.pits[15]],
      reason: 'resigned',
      records: this.records,
    };
    this.finished = true;
    clearSavedGame();
    this.countGame(data);
    this.scene.stop(SceneKeys.Pause);
    this.scene.start(SceneKeys.GameOver, data);
  }

  /** Back to the menu; the game stays saved, so the menu offers "เล่นต่อ". */
  quitToMenu(): void {
    this.scene.stop(SceneKeys.Pause);
    this.scene.start(SceneKeys.MainMenu);
  }

  /** Keep the game in progress in localStorage; a finished game leaves no save. */
  private saveProgress(state: GameState): void {
    if (state.phase === 'playing') saveGame({ state, opponent: this.opponent, records: this.records });
    else clearSavedGame();
  }

  /** Add a finished game to the statistics (Stats screen). */
  private countGame(data: GameOverData): void {
    saveFinishedGame({
      opponent: data.opponent,
      mode: data.mode,
      winner: data.winner,
      stores: data.stores,
      records: data.records,
      resigned: data.reason === 'resigned',
    });
  }

  // ── Building the screen ────────────────────────────────────────────────────

  private drawBoard(): void {
    const { board } = LAYOUT;
    this.add.image(0, 0, 'bamboo').setOrigin(0);
    this.add.image(board.x, board.y, 'board').setOrigin(0);
    this.piles = new SeedPiles(this);
  }

  private createSlots(): void {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const { x, y } = slotPosition(i);
      if (isStore(i)) {
        const owner: Player = i === P1_STORE ? 0 : 1;
        const shape = this.add.circle(x, y, LAYOUT.store.radius).setStrokeStyle(1, PLAYER_COLOR[owner]);
        const beside = countPosition(i);
        const count = this.boardStyle === 'numbers' ? { x, y } : beside;
        const label = this.label(count.x, count.y, '0', 18, CSS.cream, true).setOrigin(0.5);
        const tag = this.label(beside.x - 26, beside.y, owner === 0 ? 'P1' : 'P2', 10, PLAYER_CSS[owner]).setOrigin(0.5);
        if (this.facing && owner === 1) {
          tag.setRotation(Math.PI);
          label.setRotation(Math.PI);
        }
        this.slots[i] = { shape, label };
        continue;
      }

      const shape = this.add.circle(x, y, LAYOUT.pitRadius);
      const numbers = this.boardStyle === 'numbers';
      const count = numbers ? { x, y } : countPosition(i);
      const label = this.label(count.x, count.y, '0', numbers ? 16 : 12, CSS.cream, true).setOrigin(0.5);
      // "หันหน้าเข้าหากัน": the person across the table reads P2's numbers the right way up.
      if (this.facing && i > P1_STORE) label.setRotation(Math.PI);
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
    this.p2Label = this.label(12, 14, '', 12, CSS.dim, true).setOrigin(0, 0.5);
    // Upside down, the text must grow to the right of x from its other end.
    if (this.facing) this.p2Label.setOrigin(1, 0.5).setRotation(Math.PI);
    this.roundLabel = this.label(240, 14, '', 12, CSS.dim).setOrigin(0.5);
    this.speedButton = this.label(468, 14, '', 12, CSS.gold, true)
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.speedButton.on('pointerdown', () => this.cycleSpeed());

    this.banner = this.label(240, 45, '', 14, CSS.gold, true).setOrigin(0.5).setAlpha(0);
    this.p1Label = this.label(12, 236, '', 12, CSS.dim, true).setOrigin(0, 0.5);
    this.messageLabel = this.label(240, 256, '', 12, CSS.cream).setOrigin(0.5);
    this.pauseButton = this.label(468, 236, '≡ พักเกม', 12, CSS.gold, true)
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerdown', () => this.openPause());
  }

  private createHand(): void {
    this.hand = new SowingHand(this, this.boardStyle === 'hand', this.facing);
  }

  private setupInput(): void {
    // Gameobject and scene pointer events can arrive in either order, so the scene
    // handler ignores the very press that started the move (same downTime).
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        this.lastInputTouch = pointer.wasTouch;
        if (over.includes(this.speedButton) || over.includes(this.pauseButton)) return;
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
    onKeyDown(this, 'ESC', () => (this.selectedPit !== null ? this.clearSelection() : this.openPause()));
    onKeyDown(this, 'P', () => this.openPause());
    onKeyDown(this, 'F', () => this.cycleSpeed());

    // Gamepad (GDD §3.8.1). An unplugged pad pauses the game (AC-G5).
    onPadAction(this, (action, slot) => this.onPad(action, slot));
    onPadDisconnected(this, () => this.openPause(true));
  }

  private onPad(action: PadAction, slot: number): void {
    if (action === 'pause') return this.openPause(false);
    if (action === 'speed') return this.cycleSpeed();
    if (action === 'confirm' && this.busy) return this.requestSkip(); // any pad can skip
    if (!this.padMayPlay(slot)) return;
    if (action === 'left') this.moveSelection(-1);
    else if (action === 'right') this.moveSelection(1);
    else if (action === 'confirm') this.confirmSelection();
    else if (action === 'cancel') this.clearSelection();
  }

  /**
   * Two people with two pads: the first pad plays the bottom row (P1), the second the top
   * row (P2). With one pad, or against the AI, the pad plays for whoever's turn it is (the
   * AI's turn is already locked by confirmSelection / moveSelection).
   */
  private padMayPlay(slot: number): boolean {
    if (this.opponent !== 'human' || connectedPadCount() < 2) return true;
    return slot === this.state.current;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onPitPointer(pit: PitIndex, pointer: Phaser.Input.Pointer): void {
    if (this.busy || this.state.phase !== 'playing') return;
    if (this.isAiTurn()) {
      this.messageLabel.setText(`รอ ${this.names[AI_PLAYER]} เดิน`);
      return;
    }
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
    if (this.busy || this.isAiTurn()) return;
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
    if (this.isAiTurn()) return;
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
    this.speed = nextSowSpeed(this.speed);
    saveSowSpeed(this.registry, this.speed);
    this.speedButton.setText(this.speedText());
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
    this.records = addMoveToRecords(this.records, before.current, result.steps);
    this.dropTimes = [];
    // Save at once (a reload mid-animation resumes after this move). A finished round is
    // saved as the next round, which is fully determined by it.
    const nextRound = this.state.phase === 'roundOver' ? startNextRound(this.state) : null;
    this.saveProgress(nextRound?.state ?? this.state);
    this.refreshTurnUi();
    await this.animate(result.steps, before);
    this.renderBoard(this.state);

    if (this.state.phase === 'roundOver') {
      await this.wait(this.pauseMs(900));
      const roundEnded = this.state;
      const next = nextRound ?? startNextRound(roundEnded);
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
    this.maybePlayAi();
  }

  /** If it is the AI's turn, ask it (in the worker) and play its pit after a short pause. */
  private maybePlayAi(): void {
    if (!this.ai || this.aiThinking || this.busy || !this.isAiTurn() || this.opponent === 'human') return;
    const level = this.opponent;
    const token = this.aiToken;
    const asked = this.state;
    const started = this.time.now;
    this.aiThinking = true;
    this.refreshTurnUi();
    void this.ai.choose(asked, level).then((pit) => {
      // Ignore answers for a game or position that no longer exists.
      if (token !== this.aiToken || this.state !== asked || !this.sys.isActive()) return;
      const minThink = this.reducedMotion ? 0 : AI_THINK_MS[level] / Math.max(this.speed, 1);
      const delay = Math.max(0, minThink - (this.time.now - started));
      this.time.delayedCall(delay, () => {
        if (token !== this.aiToken || this.state !== asked) return;
        this.aiThinking = false;
        if (this.choosePit(pit)) this.aiMoves += 1;
        else this.refreshTurnUi();
      });
    });
  }

  private async animate(steps: readonly Step[], from: GameState): Promise<void> {
    this.shown = [...from.pits];
    this.shownDead = [...from.dead];
    this.dropsThisMove = 0;
    for (const step of steps) {
      if (this.skipRequested || !this.sys.isActive()) break;
      await this.animateStep(step);
    }
    this.hand.hide();
  }

  private async animateStep(step: Step): Promise<void> {
    // Only pickup + drops run on the seed rhythm; anything else restarts it afterwards.
    if (step.kind !== 'drop') this.nextBeatAt = null;
    switch (step.kind) {
      case 'pickup':
        this.setShown(step.pit, 0);
        this.hand.take(step.player, step.pit, step.seeds);
        await this.wait(this.beat());
        break;

      case 'drop':
        this.dropsThisMove += 1;
        await this.moveHandTo(step.pit, this.beat());
        this.dropTimes.push(this.time.now);
        this.setShown(step.pit, step.pitSeeds, true);
        this.hand.dropped(step.handSeeds);
        // The empty hand stays open for a moment before it goes or picks up again.
        if (step.handSeeds === 0 && this.boardStyle === 'hand') await this.wait(this.pauseMs(160));
        break;

      case 'relay':
        this.setShown(step.pit, 0, true);
        this.hand.take(step.player, step.pit, step.seeds);
        this.showBanner(`หว่านต่อ ${step.seeds} เม็ด`, CSS.cream);
        await this.wait(this.dropMs() * 2);
        break;

      case 'capture': {
        this.hand.hide();
        const store = storeOf(step.player);
        this.setShown(step.opposite, 0);
        this.setShown(step.pit, 0);
        await this.flySeeds(step.opposite, store, step.toStore);
        this.setShown(store, this.shown[store] + step.toStore, true);
        this.showBanner(`กิน! +${step.toStore}`, PLAYER_CSS[step.player]);
        this.buzz(step.player);
        await this.wait(this.pauseMs(400));
        break;
      }

      case 'extraTurn':
        // No "move again" banner when the round ends right after (nothing left to play).
        // `this.state` already holds the result of the move being animated.
        if (this.state.phase !== 'playing') break;
        this.showBanner(`${this.names[step.player]} ได้เดินอีกตา!`, PLAYER_CSS[step.player]);
        await this.wait(this.pauseMs(600));
        break;

      case 'sideEmpty':
        this.showBanner(`หลุมฝั่ง${this.names[step.player]}หมด: จบรอบ`, PLAYER_CSS[step.player]);
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
        this.hand.hide();
        break;

      case 'pass':
        this.showBanner(`${this.names[step.player]} ไม่มีเม็ด ข้ามตา`, PLAYER_CSS[step.player]);
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
          `รอบที่ ${step.round}/${this.state.maxRounds}: ${this.names[step.starter]} เริ่ม`,
          PLAYER_CSS[step.starter],
        );
        await this.wait(this.pauseMs(700));
        break;
    }
  }

  private finishGame(): void {
    this.finished = true;
    const s = this.state;
    const data: GameOverData = {
      mode: s.mode,
      ruleset: s.ruleset,
      opponent: this.opponent,
      maxRounds: s.maxRounds,
      round: s.round,
      winner: s.winner,
      stores: s.lastRound?.stores ?? [s.pits[7], s.pits[15]],
      reason: s.endReason ?? 'singleRound',
      records: this.records,
    };
    this.countGame(data);
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
      this.showSeeds(i);
    });
    this.refreshPitStyles();
  }

  private setShown(index: PitIndex, seeds: number, pulse = false): void {
    this.shown[index] = seeds;
    const slot = this.slots[index];
    slot.label.setText(this.shownDead[index] ? '×' : String(seeds));
    this.showSeeds(index);
    if (pulse && !this.reducedMotion && !this.skipRequested) this.piles.bounce(index);
  }

  /** The marbles of a slot (none when seeds are shown as numbers). */
  private showSeeds(index: PitIndex): void {
    this.piles.set(index, this.boardStyle === 'numbers' ? 0 : this.shown[index]);
  }

  private setDead(index: PitIndex, dead: boolean): void {
    this.shownDead[index] = dead;
    this.slots[index].label.setText(dead ? '×' : String(this.shown[index]));
    this.refreshPitStyles();
  }

  private refreshPitStyles(): void {
    const humanToPlay = this.state.phase === 'playing' && !this.busy && !this.isAiTurn();
    const legal = new Set(humanToPlay ? this.legalPits() : []);
    const cur = this.state.current;
    this.slots.forEach((slot, i) => {
      if (isStore(i)) return;
      const shape = slot.shape;
      if (this.shownDead[i]) {
        shape.setFillStyle(COLORS.dead, 0.7).setStrokeStyle(1, COLORS.dead);
        slot.label.setColor(CSS.dim);
        return;
      }
      slot.label.setColor(CSS.cream);
      if (this.selectedPit === i) {
        shape.setFillStyle(COLORS.gold, 0.3).setStrokeStyle(3, COLORS.gold);
      } else if (legal.has(i)) {
        shape.setFillStyle(COLORS.gold, this.hoverPit === i ? 0.18 : 0).setStrokeStyle(2, PLAYER_COLOR[cur]);
      } else {
        shape.setFillStyle(COLORS.gold, 0).setStrokeStyle();
      }
    });
  }

  private refreshTurnUi(): void {
    const s = this.state;
    // While sowing, the engine state already points at the NEXT player; show the mover.
    const active: Player | null = this.busy ? this.sowingPlayer : s.phase === 'playing' ? s.current : null;
    const label = (p: Player) => `${active === p ? '▶ ' : ''}${this.names[p]}`;
    this.p1Label.setText(`${label(0)}  (แถวล่าง)`).setColor(active === 0 ? PLAYER_CSS[0] : CSS.dim);
    this.p2Label.setText(`${label(1)}  (แถวบน)`).setColor(active === 1 ? PLAYER_CSS[1] : CSS.dim);
    const mode = s.mode === 'full' ? `เกมเต็ม · รอบ ${s.round}/${s.maxRounds}` : 'เกมสั้น';
    this.roundLabel.setText(`${mode} · ${RULESET_NAME[s.ruleset]}`);
    this.speedButton.setText(this.speedText());
    this.messageLabel.setText(
      this.busy
        ? `${active === null ? '' : `${this.names[active]} กำลังหว่าน · `}แตะ/คลิกที่ใดก็ได้เพื่อข้าม`
        : this.isAiTurn()
          ? `${this.names[AI_PLAYER]} กำลังคิด...`
          : `ตาของ${this.names[s.current]}: เลือกหลุมฝั่งตัวเองที่มีเม็ด`,
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

  /**
   * One seed drop. Long relay chains speed themselves up (×2 after 30 drops, ×4 after 60,
   * GDD §3.7) — except at the slow settings, where the player chose to watch every seed.
   */
  private dropMs(): number {
    if (this.reducedMotion) return 0;
    const accel = this.speed < 1 ? 1 : this.dropsThisMove > 60 ? 4 : this.dropsThisMove > 30 ? 2 : 1;
    return BASE_DROP_MS / (this.speed * accel);
  }

  /**
   * Wait until the next seed is due. Each beat is scheduled from the previous one rather
   * than from when the last tween happened to finish, so frame rounding does not pile up
   * over a move and the average drop time stays on the setting (AC-UI3). After a pause
   * (pause menu, tab in the background) the rhythm restarts instead of catching up.
   */
  private beat(): number {
    const ms = this.dropMs();
    if (ms <= 0) return 0;
    const now = this.time.now;
    const onSchedule = this.nextBeatAt !== null && this.nextBeatAt >= now - ms;
    const due = (onSchedule ? (this.nextBeatAt as number) : now) + ms;
    this.nextBeatAt = due;
    return Math.max(0, due - now);
  }

  /** A capture: rumble the pads (and an Android phone the player is touching). */
  private buzz(capturer: Player): void {
    if (!this.vibration || this.skipRequested) return;
    this.buzzCount += 1;
    // Two people with two pads: only the capturer's pad. Otherwise every pad.
    rumble(this.opponent === 'human' && connectedPadCount() >= 2 ? capturer : null);
    if (this.lastInputTouch) {
      try {
        navigator.vibrate?.(60);
      } catch {
        /* no vibration motor or not allowed */
      }
    }
  }

  /** Banners and pauses: shorter when fast, but never longer than normal when slow. */
  private pauseMs(ms: number): number {
    return this.reducedMotion ? 0 : ms / Math.max(this.speed, 1);
  }

  private speedText(): string {
    return `ความเร็ว: ${SOW_SPEED_LABEL[this.speed]}`;
  }

  private moveHandTo(index: PitIndex, ms: number): Promise<void> {
    const p = this.hand.spot(index);
    if (ms <= 0 || this.skipRequested) {
      this.hand.body.setPosition(p.x, p.y);
      return Promise.resolve();
    }
    return this.tweenAsync({
      targets: this.hand.body,
      x: p.x,
      y: p.y,
      duration: ms,
      ease: 'Sine.InOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => this.hand.travel(tween.progress),
    });
  }

  /** Seeds fly from a pit into a store (captures, and leftovers at round end). */
  private async flySeeds(from: PitIndex, to: PitIndex, count: number, baseMs = 450): Promise<void> {
    const ms = this.pauseMs(baseMs);
    if (ms <= 0 || this.skipRequested) return;
    const a = slotPosition(from);
    const b = slotPosition(to);
    const parts =
      this.boardStyle === 'numbers'
        ? [
            this.add.circle(0, 0, 10, COLORS.seedLight).setStrokeStyle(1, COLORS.gold),
            this.label(0, 0, String(count), 10, CSS.cream, true).setOrigin(0.5),
          ]
        : seedSpots(from)
            .slice(0, count)
            .map((s) => this.add.image(s.dx, s.dy, SEEDS_TEXTURE, FLYING_FRAME + s.variant).setOrigin(SEED_ORIGIN));
    const handful = this.add.container(a.x, a.y, parts).setDepth(11);
    await this.tweenAsync({ targets: handful, x: b.x, y: b.y, duration: ms, ease: 'Quad.InOut' });
    handful.destroy();
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

  /**
   * Pixel text (GDD §10): Thai at 12 px or more; digits and "P1" may be smaller. A dark edge
   * keeps it readable on the bamboo.
   */
  private label(x: number, y: number, text: string, size: number, color: string, bold = false): PixelText {
    return addPixelText(this, x, y, text, { size, color, bold, outline: CSS.textEdge });
  }
}
