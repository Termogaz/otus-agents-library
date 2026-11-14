import { useState, type ReactNode } from 'react';
import { m, useReducedMotion } from 'motion/react';

// Состояние первой загрузки данных страницы (FR-1): обновление после действия его не меняет
export type LoadState = 'loading' | 'ready' | 'failed';

type Props = {
  load: LoadState;
  // Текст пустого списка из ux-patterns.md; `null`, если список не пуст
  empty: string | null;
  children: ReactNode;
};

// Смена пустого состояния на таблицу проявляется за 150 мс (D-07)
const FADE_SECONDS = 0.15;

// Вместо таблицы: «Загрузка…», «Данные не загружены» или текст пустого списка.
// Тексты без живых ролей: итоги действий и ошибки живут только в StatusMessage
export function ListState({ load, empty, children }: Props) {
  const reduced = useReducedMotion();
  // Был ли показан текст пустого списка: только после него таблица проявляется, а не появляется сразу
  const [seenEmpty, setSeenEmpty] = useState(false);
  const isEmpty = load === 'ready' && empty !== null;
  if (isEmpty && !seenEmpty) setSeenEmpty(true);

  if (load === 'loading') return <p className="text-text-muted">Загрузка…</p>;
  if (load === 'failed') return <p className="text-text-muted">Данные не загружены</p>;
  if (empty !== null) return <p className="text-text-muted">{empty}</p>;
  return (
    <m.div
      initial={seenEmpty && !reduced ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : FADE_SECONDS }}
    >
      {children}
    </m.div>
  );
}
