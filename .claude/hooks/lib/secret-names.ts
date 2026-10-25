// Единое определение секретных имён для hooks protect-files и reviewer-readonly (D-07, D-08).
// Чистые предикаты без I/O: решают только по строке, существует ли файл — не проверяют.
import path from 'node:path';

// Шаблоны переменных окружения: секретов в них нет, читать их можно (D-08).
// `.env.dist` сюда намеренно не входит — в нём обычно лежат реальные значения.
export const ENV_TEMPLATES: ReadonlySet<string> = new Set([
  '.env.example',
  '.env.sample',
  '.env.template',
]);

// Остаток имени после `.env`: латиница, цифры, `_`, `.`, `-`, символы глоба, а также `~ { } , : #` —
// редакторские бэкапы (`.env~`) и brace-expansion (`.env{,}`), их тоже читает shell.
// Хвост со скобкой `)` или кавычкой (`.env*)`, `.env"}`) — это обрывок текста, а не имя файла.
const ENV_NAME_TAIL = /^[A-Za-z0-9_.\-*?[\]~{},:#]*$/;

// Защита записи: любое имя `.env*`, включая шаблоны.
export function isEnvFileName(base: string): boolean {
  return base.startsWith('.env');
}

// Защита чтения: `.env*`, кроме шаблонов.
export function isSecretFileName(base: string): boolean {
  if (!base.startsWith('.env')) return false;
  if (ENV_TEMPLATES.has(base)) return false;
  return ENV_NAME_TAIL.test(base.slice('.env'.length));
}

// Путь-аргумент команды указывает на секретный файл.
// Обратные слеши НЕ заменяются на прямые: иначе regex-шаблон `\.env` у grep превратится в путь `/.env`.
export function isSecretPath(arg: string): boolean {
  return isSecretFileName(path.posix.basename(path.posix.normalize(arg)));
}

// Операнд команды прячет секретный путь после разделителя: `if=.env` (dd), `@.env` (curl),
// `HEAD:.env` (git show). Делим по `=`, `@`, `:` и проверяем каждую непустую часть как путь.
// Обратные слеши, как и в isSecretPath, не заменяются.
export function isSecretOperand(arg: string): boolean {
  if (isSecretPath(arg)) return true;
  return arg.split(/[=@:]/).some((part) => part !== '' && isSecretPath(part));
}
