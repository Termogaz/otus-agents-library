import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Имя файла окружения в корне проекта: единственное место, где оно записано в коде.
// Остальные модули зовут loadLocalEnv() без аргумента.
export const LOCAL_ENV_FILE = '.env';

// Читает файл окружения в процессе Node и дополняет target переменными, которых там ещё нет:
// уже заданные (из оболочки, compose, CI) не перезаписываются. Флаг --env-file через tsx не
// проверен, поэтому разбор свой (parseEnv из node:util, без зависимостей); агент файл не открывает.
// Возвращает число записанных ключей; отсутствие файла — не ошибка.
export function loadLocalEnv(
  file: string = LOCAL_ENV_FILE,
  target: NodeJS.ProcessEnv = process.env,
): number {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }

  let loaded = 0;
  for (const [key, value] of Object.entries(parseEnv(text))) {
    if (target[key] === undefined) {
      target[key] = value;
      loaded += 1;
    }
  }
  return loaded;
}
