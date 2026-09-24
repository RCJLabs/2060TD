/**
 * A small event emitter: `on`, `once`, `off`, `emit`, and nothing else the
 * game calls.
 *
 * A listener added while an event is being emitted does not hear that
 * emission, and one removed during it still does if it was already due: the
 * list is copied before it is walked. That is how Phaser's emitter behaves,
 * and the scenes' `once(SHUTDOWN, ...)` chains lean on it.
 */
/** Any handler: one that takes a pointer and one that takes nothing are both listeners. */
type Listener = (...args: never[]) => void;

interface Entry {
  fn: Listener;
  once: boolean;
}

export class Emitter {
  private readonly listeners = new Map<string, Entry[]>();

  on(event: string, fn: Listener): this {
    return this.listen(event, fn, false);
  }

  once(event: string, fn: Listener): this {
    return this.listen(event, fn, true);
  }

  /** Remove `fn` from `event`, or every listener on it when `fn` is omitted. */
  off(event: string, fn?: Listener): this {
    const list = this.listeners.get(event);
    if (!list) return this;
    if (!fn) {
      this.listeners.delete(event);
      return this;
    }
    const at = list.findIndex((entry) => entry.fn === fn);
    if (at >= 0) list.splice(at, 1);
    if (list.length === 0) this.listeners.delete(event);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const entry of [...list]) {
      if (entry.once) this.drop(event, entry);
      (entry.fn as (...a: unknown[]) => void)(...args);
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  private drop(event: string, entry: Entry): void {
    const list = this.listeners.get(event);
    const at = list?.indexOf(entry) ?? -1;
    if (at >= 0) list!.splice(at, 1);
    if (list && list.length === 0) this.listeners.delete(event);
  }

  private listen(event: string, fn: Listener, once: boolean): this {
    const list = this.listeners.get(event);
    if (list) list.push({ fn, once });
    else this.listeners.set(event, [{ fn, once }]);
    return this;
  }
}
