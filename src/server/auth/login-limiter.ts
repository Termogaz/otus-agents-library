export type LoginLimiterOptions = {
  // Неудач на пару логин+адрес за окно
  maxFailures?: number;
  // Неудач с одного адреса по всем логинам за окно: перебор случайных логинов упирается в него
  maxFailuresPerAddress?: number;
  windowMs?: number;
  // Предел записей в каждой таблице счётчиков (память процесса ограничена)
  maxEntries?: number;
  now?: () => Date;
};

// Адрес клиента неизвестен (req.ip пуст) — все такие запросы делят один счётчик
const UNKNOWN_ADDRESS = 'unknown';

// Лимит неудачных входов в памяти процесса. Ключ — пара логин+адрес клиента (req.ip с учётом
// TRUST_PROXY): перебор с одного адреса не запирает тот же логин для владельца на другом адресе.
// Второй счётчик — по адресу через все логины. Окно скользящее: считаются неудачи за windowMs.
//
// Попытка резервируется до медленной проверки пароля (tryBegin) и сразу считается неудачей;
// успех снимает резерв (recordSuccess). Так параллельные запросы не проскакивают мимо лимита,
// пока идёт scrypt.
export class LoginLimiter {
  private readonly pairs: FailureLog;
  private readonly addresses: FailureLog;

  constructor({
    maxFailures = 5,
    maxFailuresPerAddress = 30,
    windowMs = 15 * 60_000,
    maxEntries = 10_000,
    now = () => new Date(),
  }: LoginLimiterOptions = {}) {
    this.pairs = new FailureLog(maxFailures, windowMs, maxEntries, now);
    this.addresses = new FailureLog(maxFailuresPerAddress, windowMs, maxEntries, now);
  }

  isBlocked(login: string, address?: string): boolean {
    return this.pairs.isLocked(pairKey(login, address)) || this.addresses.isLocked(addr(address));
  }

  // Резервирует попытку: false — лимит исчерпан или вытеснить из памяти нечего (там только
  // действующие блокировки), тогда отвечаем 429, а не забываем чужие счётчики
  tryBegin(login: string, address?: string): boolean {
    const pair = pairKey(login, address);
    const from = addr(address);
    if (this.pairs.isLocked(pair) || this.addresses.isLocked(from)) return false;
    if (!this.pairs.makeRoom(pair) || !this.addresses.makeRoom(from)) return false;
    this.pairs.add(pair);
    this.addresses.add(from);
    return true;
  }

  // Неудача без предварительного резерва
  recordFailure(login: string, address?: string): void {
    const pair = pairKey(login, address);
    const from = addr(address);
    if (this.pairs.makeRoom(pair)) this.pairs.add(pair);
    if (this.addresses.makeRoom(from)) this.addresses.add(from);
  }

  // Попытка закончилась без проверки пароля (например, сбой БД): резерв снимается
  release(login: string, address?: string): void {
    this.pairs.removeLast(pairKey(login, address));
    this.addresses.removeLast(addr(address));
  }

  // Верный пароль сбрасывает счётчик пары. С адреса снимается только резерв этой попытки:
  // вход в свою учётку не обнуляет бюджет адреса для перебора чужих
  recordSuccess(login: string, address?: string): void {
    this.pairs.clear(pairKey(login, address));
    this.addresses.removeLast(addr(address));
  }
}

// Отметки неудач по ключу. Map хранит порядок вставки; запись при обновлении переставляется
// в конец, поэтому первая запись — самая давняя по последней неудаче.
class FailureLog {
  private readonly entries = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxEntries: number,
    private readonly now: () => Date,
  ) {}

  isLocked(key: string): boolean {
    return this.recent(key).length >= this.limit;
  }

  // Освобождает место под новый ключ. Вытесняется самая давняя запись без действующей
  // блокировки: поток неудач на другие ключи не может сбросить чужую блокировку.
  makeRoom(key: string): boolean {
    if (this.entries.has(key) || this.entries.size < this.maxEntries) return true;
    for (const candidate of [...this.entries.keys()]) {
      // recent удаляет запись, у которой не осталось свежих отметок
      if (this.recent(candidate).length < this.limit) {
        this.entries.delete(candidate);
        return true;
      }
    }
    return false;
  }

  add(key: string): void {
    const times = this.recent(key);
    times.push(this.now().getTime());
    this.entries.delete(key);
    this.entries.set(key, times);
  }

  removeLast(key: string): void {
    const times = this.recent(key);
    times.pop();
    if (times.length === 0) this.entries.delete(key);
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  // Неудачи в пределах окна; устаревшие отметки удаляются при обращении
  private recent(key: string): number[] {
    const times = this.entries.get(key);
    if (!times) return [];
    const from = this.now().getTime() - this.windowMs;
    const fresh = times.filter((time) => time > from);
    if (fresh.length === 0) this.entries.delete(key);
    else if (fresh.length !== times.length) this.entries.set(key, fresh);
    return fresh;
  }
}

function normalize(login: string): string {
  return login.trim().toLowerCase();
}

function addr(address: string | undefined): string {
  return address || UNKNOWN_ADDRESS;
}

// JSON-массив: логин и адрес не склеиваются в одинаковый ключ ни при каких символах
function pairKey(login: string, address: string | undefined): string {
  return JSON.stringify([normalize(login), addr(address)]);
}
