/**
 * Identity gate for callbacks whose side effects must happen once. A fresh
 * WeakSet on reset makes scene restart cleanup deterministic without retaining
 * dead enemies.
 */
export class SingleFireGate<T extends object> {
  private claimed = new WeakSet<T>();

  claim(value: T): boolean {
    if (this.claimed.has(value)) return false;
    this.claimed.add(value);
    return true;
  }

  reset(): void {
    this.claimed = new WeakSet<T>();
  }
}
