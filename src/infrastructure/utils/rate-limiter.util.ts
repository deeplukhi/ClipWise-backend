export class RateLimiter {
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }> = [];
  private activeCount = 0;
  private timestamps: number[] = [];
  private lastCallTime = 0;

  constructor(
    private maxRequests: number,
    private windowMs: number,
    private maxConcurrency: number,
    private minIntervalMs: number,
  ) {}

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.process();
    }) as Promise<T>;
  }

  private async process(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) return;

    const now = Date.now();

    // Prune timestamps outside the window
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    // Rate limit: check if we've hit the max in this window
    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const wait = oldest + this.windowMs - now + 50;
      setTimeout(() => this.process(), wait);
      return;
    }

    // Minimum interval between calls
    const sinceLast = now - this.lastCallTime;
    if (sinceLast < this.minIntervalMs) {
      setTimeout(() => this.process(), this.minIntervalMs - sinceLast + 10);
      return;
    }

    this.activeCount++;
    const item = this.queue.shift()!;
    this.timestamps.push(now);
    this.lastCallTime = now;

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    } finally {
      this.activeCount--;
      this.process();
    }
  }
}
