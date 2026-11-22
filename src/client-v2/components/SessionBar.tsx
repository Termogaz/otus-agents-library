import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Me } from '../api/live-client';

type Props = {
  me: Me;
  onLogout: () => Promise<void>;
};

const ROLE_LABELS: Record<Me['role'], string> = {
  librarian: 'Библиотекарь',
  reader: 'Читатель',
};

// Строка сессии: кто вошёл, в какой роли, и «Выйти». Кнопка блокируется на время запроса.
export function SessionBar({ me, onLogout }: Props) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await onLogout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-4 pb-4 text-sm md:px-6">
      <p className="flex flex-wrap gap-x-2 text-text-muted">
        <span className="font-semibold text-text">{me.login}</span>
        <span>{ROLE_LABELS[me.role]}</span>
        {me.readerName !== null && <span>{me.readerName}</span>}
      </p>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void logout()}>
        Выйти
      </Button>
    </div>
  );
}
