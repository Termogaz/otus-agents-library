import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// Оболочка страницы: наполнение — план 07-04
createRoot(root).render(
  <StrictMode>
    <main>
      <h1 className="text-xl font-semibold">Библиотека</h1>
    </main>
  </StrictMode>,
);
