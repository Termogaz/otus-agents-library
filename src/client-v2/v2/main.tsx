import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../../client/api';
import { App } from '../App';
import '../styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// Страница /v2/: настоящий API старого клиента и тот же App, что в прототипе
createRoot(root).render(
  <StrictMode>
    <App api={api} mode="server" variant="v2" />
  </StrictMode>,
);
