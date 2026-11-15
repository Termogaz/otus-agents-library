import { StrictMode, useMemo, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createDemoApi } from '../demo/demo-api';
import { App } from '../App';
import { scenarioOptions } from './scenarios';
import '../styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// Хеш адресной строки как внешнее состояние: смена хеша перерисовывает страницу без перезагрузки
function subscribeHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function readHash(): string {
  return window.location.hash;
}

// Страница /prototype/: тот же App, что на /v2/, но данные из адаптера в памяти браузера.
// Запросов к /api нет вообще (D-10); состояние макета выбирает хеш (D-02)
function Prototype() {
  const hash = useSyncExternalStore(subscribeHash, readHash);
  const scenario = scenarioOptions(hash);
  // Новый адаптер на каждый сценарий; «сейчас» фиксируется в момент открытия сценария
  const api = useMemo(() => {
    const openedAt = new Date();
    return createDemoApi({ ...scenario.apiOptions, now: () => openedAt });
  }, [scenario]);

  return (
    <>
      <p>Прототип на демо-данных</p>
      <App key={scenario.name} api={api} mode="demo" variant="prototype" />
    </>
  );
}

createRoot(root).render(
  <StrictMode>
    <Prototype />
  </StrictMode>,
);
