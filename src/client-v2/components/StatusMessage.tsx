import { useEffect, useRef } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Итог действия: один на страницу, место задаёт `place` (ux-patterns.md, правила итога)
export type OutcomeKind = 'error' | 'success' | 'saved';
export type OutcomePlace = 'page' | 'books' | 'readers' | 'checkout' | 'return';
// id уникален у каждого итога: по нему новый итог входит заново, даже с тем же текстом
export type Outcome = { id: number; kind: OutcomeKind; place: OutcomePlace; text: string };

// Вход сообщения (D-07): проявление и сдвиг на 4 px за 200 мс, без анимации ухода
const MotionAlert = m.create(Alert);
const ENTRANCE_SECONDS = 0.2;

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
  // При prefers-reduced-motion итог сразу в конечном виде: reducedMotion="user" отключает только сдвиг
  const reduced = useReducedMotion();

  // Эффект по объекту итога: каждый новый итог показывается, даже с тем же текстом
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (takeFocus) element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [outcome, takeFocus]);

  return (
    <MotionAlert
      key={outcome.id}
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : ENTRANCE_SECONDS }}
      role={outcome.kind === 'error' ? 'alert' : 'status'}
      tabIndex={takeFocus ? -1 : undefined}
      className={cn(
        KIND_CLASSES[outcome.kind],
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      {outcome.text}
    </MotionAlert>
  );
}
