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
    space: Phaser.Input.Keyboard.Key;
    dash: Phaser.Input.Keyboard.Key;
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

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input plugin is unavailable');
    const noticePointer = (): void => {
      this.pointerSeen = true;
    };
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, noticePointer);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, noticePointer);
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      arrowUp: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      arrowDown: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      arrowLeft: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      arrowRight: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      dash: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    };
  }

  /** Normalized movement direction. */
  getMoveVector(): Phaser.Math.Vector2 {
    const k = this.keys;
    const x = Number(k.right.isDown || k.arrowRight.isDown) - Number(k.left.isDown || k.arrowLeft.isDown);
    const y = Number(k.down.isDown || k.arrowDown.isDown) - Number(k.up.isDown || k.arrowUp.isDown);
    return new Phaser.Math.Vector2(x, y).normalize();
  }

  /** Held mouse attack (desktop): strikes toward the cursor. */
  isMouseAttackDown(): boolean {
    return this.scene.input.activePointer.isDown;
  }

  /** Held Space: auto-strikes the nearest hunter (same as the mobile ⚔ button). */
  isAutoAttackDown(): boolean {
    return this.keys.space.isDown;
  }

  /** Shift, edge-triggered: holding it must not chain dashes on every frame. */
  isDashJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.dash);
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
}
