import * as React from 'react';
import { cn } from '@/lib/utils';

// Поле по DESIGN.md: высота 40 px, граница цвета поля ввода, фокус контуром, ошибка — граница danger
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-base placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-text aria-invalid:border-destructive user-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
