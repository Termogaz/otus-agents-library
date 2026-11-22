import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, api } from '../../client/api';
import { guardSession, loginUrl, logout, me, type Me } from '../api/live-client';
import { SessionBar } from '../components/SessionBar';
import { App } from '../App';
import '../styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

const toLogin = () => window.location.assign(loginUrl('/v2/'));

async function leave(): Promise<void> {
  await logout();
  window.location.assign('/login/');
}

// Страница /v2/: настоящий API старого клиента и тот же App, что в прототипе.
// Сессия проверяется до первой отрисовки: без входа страница ведёт на /login/ (D-12).
async function start(container: HTMLElement): Promise<void> {
  let current: Me | null = null;
  try {
    current = await me();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
      toLogin();
      return;
    }
    // Сетевой сбой и прочие отказы: App сам покажет «Сервер недоступен» и «API: недоступен»
  }

  createRoot(container).render(
    <StrictMode>
      <App api={guardSession(api, toLogin)} mode="server" variant="v2" />
      {/* Строка сессии после App: Tab с первого нажатия попадает в форму выдачи, порядок фокуса совпадает с порядком на экране */}
      {current !== null && current.login !== null && <SessionBar me={current} onLogout={leave} />}
    </StrictMode>,
  );
}

void start(root);
