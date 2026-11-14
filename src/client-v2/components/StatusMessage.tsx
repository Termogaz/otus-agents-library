import { useEffect, useRef } from 'react';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Итог действия: один на страницу, место задаёт `place` (ux-patterns.md, правила итога)
export type OutcomeKind = 'error' | 'success' | 'saved';
export type OutcomePlace = 'page' | 'books' | 'readers' | 'checkout' | 'return';
export type Outcome = { kind: OutcomeKind; place: OutcomePlace; text: string };

// Цвета только токенами DESIGN.md; роль alert только у ошибки, остальное — status (D-12)
const KIND_CLASSES: Record<OutcomeKind, string> = {
  error: 'bg-danger-bg text-danger border-danger-border',
  success: 'bg-accent-tint text-accent border-accent',
  saved: 'bg-warn-bg text-text border-warn-border',
};

type Props = {
  outcome: Outcome;
  // Перевести фокус на итог (для «Вернуть»: кнопка исчезает вместе с фокусом)
  takeFocus?: boolean;
};

export function StatusMessage({ outcome, takeFocus = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Эффект по объекту итога: каждый новый итог показывается, даже с тем же текстом
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (takeFocus) element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [outcome, takeFocus]);

  return (
    <Alert
      ref={ref}
      role={outcome.kind === 'error' ? 'alert' : 'status'}
      tabIndex={takeFocus ? -1 : undefined}
      className={cn(
        KIND_CLASSES[outcome.kind],
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      {outcome.text}
    </Alert>
  );
}
