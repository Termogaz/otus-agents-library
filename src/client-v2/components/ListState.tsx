import type { ReactNode } from 'react';

// Состояние первой загрузки данных страницы (FR-1): обновление после действия его не меняет
export type LoadState = 'loading' | 'ready' | 'failed';

type Props = {
  load: LoadState;
  // Текст пустого списка из ux-patterns.md; `null`, если список не пуст
  empty: string | null;
  children: ReactNode;
};

// Вместо таблицы: «Загрузка…», «Данные не загружены» или текст пустого списка.
// Тексты без живых ролей: итоги действий и ошибки живут только в StatusMessage
export function ListState({ load, empty, children }: Props) {
  if (load === 'loading') return <p className="text-text-muted">Загрузка…</p>;
  if (load === 'failed') return <p className="text-text-muted">Данные не загружены</p>;
  if (empty !== null) return <p className="text-text-muted">{empty}</p>;
  return <>{children}</>;
}
