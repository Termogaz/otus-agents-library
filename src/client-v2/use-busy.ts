import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

// Блокировка одного действия на время запроса (FR-3).
// Повторный вызов, пока действие идёт, не стартует и возвращает `undefined`.
export function useBusy() {
  const [busy, setBusy] = useState(false);
  // Флаг в ref ловит второй клик в тот же момент, когда состояние ещё не перерисовано
  const locked = useRef(false);

  async function guarded<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      locked.current = false;
      // Кнопка должна стать доступной до того, как ей вернут фокус
      flushSync(() => setBusy(false));
    }
  }

  return { busy, guarded };
}
