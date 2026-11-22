import { readFileSync } from 'node:fs';

// Разбор таблиц docs/api-spec.md: спека исполняемая, тесты берут маршруты и коды отсюда (D-08)

export type SpecRole = 'anon' | 'reader' | 'librarian';
export type SpecMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type SpecRoute = {
  method: SpecMethod;
  path: string;
  roles: SpecRole[];
  success: number;
  errors: { status: number; code: string }[];
};

export type SpecErrorCode = { code: string; status: number };

const METHODS: readonly string[] = ['GET', 'POST', 'PATCH', 'DELETE'];
const ROLES: readonly string[] = ['anon', 'reader', 'librarian'];
const ROOT = new URL('../../', import.meta.url);

type Row = { line: number; cells: string[] };

// Ячейки обрезаются (Prettier выравнивает таблицы пробелами), обратные кавычки снимаются
function splitRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((cell) => cell.trim().replace(/`/g, ''));
}

// Строки таблицы, чей заголовок начинается с firstCell; чтение до первой не-табличной строки
function readTable(file: string, firstCell: string): Row[] {
  const lines = readFileSync(new URL(file, ROOT), 'utf8').split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.trimStart().startsWith('|') && splitRow(line)[0] === firstCell,
  );
  if (start === -1) throw new Error(`${file}: нет таблицы с заголовком «${firstCell}»`);

  const rows: Row[] = [];
  // Пропускаем строку заголовка и разделитель «| --- | --- |»
  for (let i = start + 2; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trimStart().startsWith('|')) break;
    rows.push({ line: i + 1, cells: splitRow(line) });
  }
  return rows;
}

function cell(row: Row, index: number, what: string): string {
  const value = row.cells[index];
  if (value === undefined) throw new Error(`строка ${row.line}: нет ячейки «${what}»`);
  return value;
}

function parseStatus(value: string, row: Row, what: string): number {
  if (!/^\d{3}$/.test(value)) {
    throw new Error(`строка ${row.line}: «${what}» — ожидался HTTP-код, получено «${value}»`);
  }
  return Number(value);
}

export function loadApiSpec(file = 'docs/api-spec.md'): SpecRoute[] {
  return readTable(file, 'Метод').map((row) => {
    const method = cell(row, 0, 'Метод');
    if (!METHODS.includes(method)) {
      throw new Error(`строка ${row.line}: неизвестный метод «${method}»`);
    }
    const roles = cell(row, 2, 'Роли')
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role !== '');
    for (const role of roles) {
      if (!ROLES.includes(role)) throw new Error(`строка ${row.line}: неизвестная роль «${role}»`);
    }
    const errors = cell(row, 4, 'Ошибки')
      .split(',')
      .map((pair) => pair.trim())
      .filter((pair) => pair !== '' && pair !== '—')
      .map((pair) => {
        const match = /^(\d{3}) ([A-Z][A-Z_]*)$/.exec(pair);
        if (!match) throw new Error(`строка ${row.line}: неверная пара «${pair}» в «Ошибки»`);
        return { status: Number(match[1]), code: match[2] as string };
      });

    return {
      method: method as SpecMethod,
      path: cell(row, 1, 'Путь'),
      roles: roles as SpecRole[],
      success: parseStatus(cell(row, 3, 'Успех'), row, 'Успех'),
      errors,
    };
  });
}

export function loadErrorCodes(file = 'docs/api-spec.md'): SpecErrorCode[] {
  return readTable(file, 'Код').map((row) => {
    const code = cell(row, 0, 'Код');
    if (!/^[A-Z][A-Z_]*$/.test(code)) throw new Error(`строка ${row.line}: неверный код «${code}»`);
    return { code, status: parseStatus(cell(row, 1, 'HTTP'), row, 'HTTP') };
  });
}
