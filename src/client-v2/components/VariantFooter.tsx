import { cn } from '@/lib/utils';

export type Variant = 'v2' | 'prototype';

type Props = {
  // Текущая страница: её ссылка помечается aria-current="page"
  current: Variant;
};

// Сайт для ссылок на / и /v2/: на отдельном хостинге прототипа они ведут на основной сайт (D-03)
const ORIGIN = import.meta.env.VITE_APP_ORIGIN ?? '';

const LINKS: { variant: Variant | 'legacy'; label: string; href: string }[] = [
  { variant: 'legacy', label: 'Прежний интерфейс', href: `${ORIGIN}/` },
  { variant: 'v2', label: 'MVP', href: `${ORIGIN}/v2/` },
  { variant: 'prototype', label: 'Прототип', href: '/prototype/' },
];

// Ссылки между тремя вариантами интерфейса (D-03); фокус — контур по DESIGN.md
export function VariantFooter({ current }: Props) {
  return (
    <nav aria-label="Варианты интерфейса" className="flex flex-wrap gap-4">
      {LINKS.map((link) => (
        <a
          key={link.variant}
          href={link.href}
          aria-current={link.variant === current ? 'page' : undefined}
          className={cn(
            'py-2 underline underline-offset-4',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            link.variant === current ? 'font-semibold text-text' : 'text-accent',
          )}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
