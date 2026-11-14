import * as React from 'react';
import { cn } from '@/lib/utils';

// Только форма сообщения; цвета задаёт StatusMessage. role можно переопределить снаружи (status вместо alert)
function Alert({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        'relative grid w-full gap-1 rounded-lg border p-3 text-left text-base',
        className,
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-title" className={cn('font-medium', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('text-base', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
