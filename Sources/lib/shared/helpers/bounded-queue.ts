export default class BoundedQueue<T> {
  private backingArray: T[];
  private capacity: number;

  public constructor(capacity: number) {
    this.backingArray = [];
    this.capacity = capacity;

    if (capacity <= 0) {
      throw new Error("Capacity must be greater than zero");
    }
  }

  private enforceCapacity(): void {
    while (this.backingArray.length > this.capacity) {
      this.backingArray.shift();
    }
  }

  /* Basic queue methods */

  public push(value: T): void {
    this.backingArray.push(value);
    this.enforceCapacity();
  }

  public peek(): T | undefined | null {
    if (this.backingArray.length === 0) {
      return null;
    }
    return this.backingArray[this.backingArray.length - 1];
  }

  public pop(): T | undefined | null {
    if (this.backingArray.length === 0) {
      return null;
    }
    return this.backingArray.pop();
  }

  /* Other methods */

  public clear(): void {
    this.backingArray.length = 0;
  }

  public forEach(method: (value: T, index: number, array: T[]) => void, _thisArg?: unknown): void {
    this.backingArray.forEach(method);
  }

  // Returns the backing array AS IS. Be very careful about what you do: if you break this array, it's on you.
  public values(): T[] {
    return this.backingArray;
  }
}
