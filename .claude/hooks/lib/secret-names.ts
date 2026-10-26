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

// Сколько вариантов даёт раскрытие скобок, прежде чем слово остаётся как есть.
const MAX_BRACE_VARIANTS = 64;

// Первая группа `{a,b}` с запятой на верхнем уровне. Группа без запятой (`{}`, `{x}`) не раскрывается.
function braceGroup(word: string): { start: number; end: number; alternatives: string[] } | null {
  for (let start = word.indexOf('{'); start !== -1; start = word.indexOf('{', start + 1)) {
    const alternatives: string[] = [];
    let depth = 0;
    let partStart = start + 1;
    for (let i = start; i < word.length; i++) {
      const ch = word[i];
      if (ch === '{') depth++;
      else if (ch === ',' && depth === 1) {
        alternatives.push(word.slice(partStart, i));
        partStart = i + 1;
      } else if (ch === '}' && --depth === 0) {
        if (alternatives.length === 0) break;
        alternatives.push(word.slice(partStart, i));
        return { start, end: i, alternatives };
      }
    }
  }
  return null;
}

// Раскрытие фигурных скобок, как в bash: `{.env,x}`, `.{env,x}`, `.e{n,m}v` (WR-03).
// Число вариантов ограничено; то, что не успели раскрыть, возвращается как есть.
export function expandBraces(word: string): string[] {
  const done: string[] = [];
  const queue = [word];
  while (queue.length > 0 && done.length + queue.length <= MAX_BRACE_VARIANTS) {
    const current = queue.shift()!;
    const group = braceGroup(current);
    if (group === null) {
      done.push(current);
      continue;
    }
    const before = current.slice(0, group.start);
    const after = current.slice(group.end + 1);
    for (const alternative of group.alternatives) queue.push(before + alternative + after);
  }
  return [...done, ...queue];
}

// Путь-аргумент команды указывает на секретный файл, в том числе после раскрытия скобок.
// Обратные слеши НЕ заменяются на прямые: иначе regex-шаблон `\.env` у grep превратится в путь `/.env`.
export function isSecretPath(arg: string): boolean {
  return expandBraces(arg).some((variant) =>
    isSecretFileName(path.posix.basename(path.posix.normalize(variant))),
  );
}

// Магия pathspec git перед путём: `:(top).env`, `:(glob)**/.env`, `:!.env`, `:^.env` (WR-04).
function stripPathspecMagic(part: string): string {
  return part.replace(/^\([^)]*\)/, '').replace(/^[!^/]+/, '');
}

// Операнд команды прячет секретный путь после разделителя: `if=.env` (dd), `@.env` (curl),
// `HEAD:.env` (git show). Делим по `=`, `@`, `:` и проверяем каждую непустую часть как путь,
// сняв магию pathspec git. Обратные слеши, как и в isSecretPath, не заменяются.
export function isSecretOperand(arg: string): boolean {
  if (isSecretPath(arg)) return true;
  return arg.split(/[=@:]/).some((part) => part !== '' && isSecretPath(stripPathspecMagic(part)));
}
