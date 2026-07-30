import Phaser from 'phaser';

/**
 * Abstracts desktop input (WASD/arrows + mouse) behind a small interface.
 *
 * Touch extension point: implement this same shape from a virtual joystick /
 * attack button and merge its output here — GameScene only reads the getters.
 */
export class InputController {
  private keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    arrowUp: Phaser.Input.Keyboard.Key;
    arrowDown: Phaser.Input.Keyboard.Key;
    arrowLeft: Phaser.Input.Keyboard.Key;
    arrowRight: Phaser.Input.Keyboard.Key;
    dash: Phaser.Input.Keyboard.Key;
    ultimate: Phaser.Input.Keyboard.Key;
  };

  /**
   * Whether the pointer has ever reported a position this scene.
   *
   * Until it has, `activePointer.worldX/worldY` are (0, 0) — the top-left
   * corner of the hall — and aiming there turns the Count to face a corner he
   * has no reason to look at. That is what made him land out of the coffin
   * staring up and to the left instead of into the room.
   */
  private pointerSeen = false;

  /** Latched on a click, consumed once by GameScene — one click, one strike. */
  private mouseAttackPressed = false;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input plugin is unavailable');
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      arrowUp: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      arrowDown: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      arrowLeft: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      arrowRight: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      dash: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      // Space, freed up now that it no longer auto-attacks (see consumeMouseAttackPressed).
      ultimate: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  /** Normalized movement direction. */
  getMoveVector(): Phaser.Math.Vector2 {
    const k = this.keys;
    const x = Number(k.right.isDown || k.arrowRight.isDown) - Number(k.left.isDown || k.arrowLeft.isDown);
    const y = Number(k.down.isDown || k.arrowDown.isDown) - Number(k.up.isDown || k.arrowUp.isDown);
    return new Phaser.Math.Vector2(x, y).normalize();
  }

  /**
   * True once per mouse click; reading it clears the latch. Deliberately NOT
   * `activePointer.isDown` (which stays true for as long as the button is
   * held) — holding the mouse down must land exactly one strike, the same as
   * a single click, not fire on every frame it is held.
   */
  consumeMouseAttackPressed(): boolean {
    const pressed = this.mouseAttackPressed;
    this.mouseAttackPressed = false;
    return pressed;
  }

  /**
   * Drop clicks collected while gameplay was not accepting input.
   *
   * InputController exists before the main menu, so the pointerdown that
   * presses START NIGHT would otherwise remain latched throughout the whole
   * opening and become a bite on the first playable frame. GameScene calls
   * this at each cinematic-to-gameplay handoff.
   */
  discardBufferedActions(): void {
    this.mouseAttackPressed = false;
    // JustDown is consumed lazily. Clear action keys as well so a Space held
    // for intro skip (or Shift pressed during a transition) cannot fire on
    // the first frame after the cinematic.
    this.keys.dash.reset();
    this.keys.ultimate.reset();
  }

  /** Shift, edge-triggered: holding it must not chain dashes on every frame. */
  isDashJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.dash);
  }

  /** Space, edge-triggered: fires the Ultimate once Wrath is full (see GameScene.tryUseUltimate). */
  isUltimateJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.ultimate);
  }

  /** False until the player has actually moved or clicked the mouse. */
  get hasAimPoint(): boolean {
    return this.pointerSeen;
  }

  /** Current aim point in world coordinates (mouse position). */
  getAimPoint(): Phaser.Math.Vector2 {
    const pointer = this.scene.input.activePointer;
    return new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.mouseAttackPressed = false;
    for (const key of Object.values(this.keys)) key.reset();
  }

  private onPointerMove(): void {
    this.pointerSeen = true;
  }

  private onPointerDown(): void {
    this.pointerSeen = true;
    this.mouseAttackPressed = true;
  }
}
