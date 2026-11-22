import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { ApiError } from '../../client/api';
import { login, me, safeNext } from '../api/live-client';
import { StatusMessage, type Outcome } from '@/components/StatusMessage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Тексты совпадают с колонкой «Текст в UI» docs/api-spec.md
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Неверный логин или пароль',
  TOO_MANY_ATTEMPTS: 'Слишком много попыток входа, подождите и повторите',
  VALIDATION_ERROR: 'Проверьте поля: данные заполнены неверно',
};

function failureText(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? 'Ошибка сервера';
  return 'Сервер недоступен';
}

// Следующая страница из адресной строки; чужой адрес заменяется на /v2/
function nextFromLocation(): string {
  return safeNext(new URLSearchParams(window.location.search).get('next'));
}

export function LoginPage() {
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  // Вход уже есть: сразу на следующую страницу. Отказ me() — гость, форма остаётся.
  useEffect(() => {
    let active = true;
    me()
      .then((current) => {
        if (active && current.login !== null) window.location.assign(nextFromLocation());
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    try {
      await login(loginName, password);
      window.location.assign(nextFromLocation());
    } catch (error) {
      counter.current += 1;
      setOutcome({ id: counter.current, kind: 'error', place: 'page', text: failureText(error) });
      setPassword('');
      setBusy(false);
      // Поле пароля не блокируется на время запроса, фокус можно вернуть сразу
      passwordRef.current?.focus();
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <main className="mx-auto flex max-w-content flex-col gap-6 p-4 md:p-6">
          <Card className="mx-auto w-full max-w-sm">
            <CardHeader>
              <h1 className="text-xl font-semibold">Вход в библиотеку</h1>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-name">Логин</Label>
                  <Input
                    id="login-name"
                    name="login"
                    autoComplete="username"
                    value={loginName}
                    onChange={(event) => setLoginName(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-password">Пароль</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    ref={passwordRef}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                {outcome && <StatusMessage outcome={outcome} />}
                <Button type="submit" disabled={busy}>
                  Войти
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </LazyMotion>
    </MotionConfig>
  );
}
