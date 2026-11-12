/** Applying a remote operation fires media events; while suppressed they are not sent back. */

export class ActionGuard {
  private _available = true;

  get available(): boolean {
    return this._available;
  }

  suppress(): void {
    this._available = false;
  }

  allow(): void {
    this._available = true;
  }
}
