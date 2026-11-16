import * as React from 'react';
import { cn } from '@/lib/utils';

type TableProps = React.ComponentProps<'table'> & {
  // Имя области прокрутки; по умолчанию берётся aria-label самой таблицы
  containerLabel?: string;
};

// Контейнер прокрутки доступен с клавиатуры: role="region", tabIndex=0 и имя (NFR-1, a11y)
function Table({ className, containerLabel, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      role="region"
      tabIndex={0}
      aria-label={containerLabel ?? props['aria-label']}
      className="relative w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <table data-slot="table" className={cn('w-full text-base', className)} {...props} />
    </div>
  );
}

// Шапка по DESIGN.md: фон surface-muted, текст text-muted
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('bg-surface-muted [&_tr]:border-b', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t border-border font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

// Минимальная высота строки 44 px (--row-height): длинный текст переносится, строка растёт
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr data-slot="table-row" className={cn('h-11 border-b border-border', className)} {...props} />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'px-3 text-left align-middle text-sm font-medium whitespace-normal text-text-muted',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-3 py-2 align-middle whitespace-normal', className)}
      {...props}
    />
  );
}

// Подпись остаётся в разметке для скринридеров и e2e, визуально скрыта
function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption data-slot="table-caption" className={cn('sr-only', className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
