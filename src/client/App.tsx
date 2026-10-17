import { useEffect, useState } from 'react';

export function App() {
  const [apiStatus, setApiStatus] = useState('проверка...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<{ status: string }>)
      .then((body) => setApiStatus(body.status))
      .catch(() => setApiStatus('недоступен'));
  }, []);

  return (
    <main>
      <h1>Библиотека</h1>
      <p>API: {apiStatus}</p>
    </main>
  );
}
