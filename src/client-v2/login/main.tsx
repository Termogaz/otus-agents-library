import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LoginPage } from './LoginPage';
import '../styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// Страница /login/: форма входа в живой API
createRoot(root).render(
  <StrictMode>
    <LoginPage />
  </StrictMode>,
);
