import { loadConfig, type AppConfig } from './config.js';
import { loadLocalEnv } from './env-file.js';
import { buildApp } from './server.js';

loadLocalEnv();

let config: AppConfig;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { app, close } = buildApp(config);

// Режим хранилища в логе есть, строки подключения нет
const server = app.listen(config.port, () => {
  console.log(`API: http://localhost:${config.port} (хранилище: ${config.storage})`);
  // Ключ в лог не попадает: только включён ли AI и какая модель
  const aiOn = config.storage === 'postgres' && Boolean(config.ai.apiKey);
  console.log(aiOn ? `AI: включён (модель ${config.ai.model})` : 'AI: выключен');
});

function shutdown(): void {
  server.close(() => {
    close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
