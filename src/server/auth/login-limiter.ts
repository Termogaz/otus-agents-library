export type LoginLimiterOptions = {
  maxFailures?: number;
  windowMs?: number;
  maxEntries?: number;
  now?: () => Date;
};

// Лимит неудачных входов в памяти процесса. Ключ — логин, а не IP: за двумя прокси (Caddy и
// nginx) адрес клиента ненадёжен. Окно скользящее: считаются неудачи за последние windowMs.
export class LoginLimiter {
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => Date;
  // Map хранит порядок вставки; запись при обновлении переставляется в конец,
  // поэтому первая запись — самая давняя по последней неудаче
  private readonly failures = new Map<string, number[]>();

  constructor({
    maxFailures = 5,
    windowMs = 15 * 60_000,
    maxEntries = 10_000,
    now = () => new Date(),
  }: LoginLimiterOptions = {}) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  isBlocked(login: string): boolean {
    return this.recent(normalize(login)).length >= this.maxFailures;
  }

  recordFailure(login: string): void {
    const key = normalize(login);
    const times = this.recent(key);
    times.push(this.now().getTime());
    this.failures.delete(key);
    this.failures.set(key, times);
    // Память ограничена: при переполнении уходят самые давние логины
    while (this.failures.size > this.maxEntries) {
      const oldest = this.failures.keys().next();
      if (oldest.done) break;
      this.failures.delete(oldest.value);
    }
  }

  recordSuccess(login: string): void {
    this.failures.delete(normalize(login));
  }

  // Неудачи в пределах окна; устаревшие записи удаляются при обращении
  private recent(key: string): number[] {
    const times = this.failures.get(key);
    if (!times) return [];
    const from = this.now().getTime() - this.windowMs;
    const fresh = times.filter((time) => time > from);
    if (fresh.length === 0) this.failures.delete(key);
    else if (fresh.length !== times.length) this.failures.set(key, fresh);
    return fresh;
  }
}

function normalize(login: string): string {
  return login.trim().toLowerCase();
}
