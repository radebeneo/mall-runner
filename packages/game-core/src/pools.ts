/**
 * Object pool. `active` lists the items in use. Releasing swaps the item with the last active
 * one, so iterate `active` backwards when releasing inside a loop.
 */
export class Pool<T> {
  readonly active: T[] = [];
  private readonly free: T[] = [];
  private readonly create: () => T;

  constructor(create: () => T, prefill = 0) {
    this.create = create;
    for (let i = 0; i < prefill; i++) this.free.push(create());
  }

  /** Items created so far, in use or free. */
  get size(): number {
    return this.active.length + this.free.length;
  }

  get freeCount(): number {
    return this.free.length;
  }

  acquire(): T {
    const item = this.free.pop() ?? this.create();
    this.active.push(item);
    return item;
  }

  /** Returns an item to the pool. Returns false if it was not in use. */
  release(item: T): boolean {
    const index = this.active.indexOf(item);
    if (index < 0) return false;
    const last = this.active.pop();
    if (last !== undefined && last !== item) this.active[index] = last;
    this.free.push(item);
    return true;
  }

  releaseAll(): void {
    for (let item = this.active.pop(); item !== undefined; item = this.active.pop()) {
      this.free.push(item);
    }
  }
}
