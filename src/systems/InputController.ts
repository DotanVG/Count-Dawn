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
  };

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input plugin is unavailable');
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
    };
  }

  /** Normalized movement direction. */
  getMoveVector(): Phaser.Math.Vector2 {
    const k = this.keys;
    const x = Number(k.right.isDown || k.arrowRight.isDown) - Number(k.left.isDown || k.arrowLeft.isDown);
    const y = Number(k.down.isDown || k.arrowDown.isDown) - Number(k.up.isDown || k.arrowUp.isDown);
    return new Phaser.Math.Vector2(x, y).normalize();
  }

  /** Held attack input: left mouse button or Space. */
  isAttackDown(): boolean {
    return this.scene.input.activePointer.isDown || this.keys.space.isDown;
  }

  /** Current aim point in world coordinates (mouse position). */
  getAimPoint(): Phaser.Math.Vector2 {
    const pointer = this.scene.input.activePointer;
    return new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }
}
