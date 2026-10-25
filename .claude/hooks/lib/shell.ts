// Упрощённый разбор shell-команды для hooks. Это эвристика, а не парсер bash:
// подстановки ($VAR, $(...)), heredoc и алиасы не раскрываются; комментарии `#` пропускаются.

export interface ShellSegment {
  // Слова простой команды: имя и аргументы, без кавычек.
  words: string[];
  // Файлы, в которые идёт вывод: цели `>`, `>>`, `>|`, `>&файл`, `2>`, `&>`.
  writeTargets: string[];
  // Файлы, из которых идёт ввод: цели `<`. Heredoc и here-string (`<<`, `<<<`) сюда не попадают.
  readTargets: string[];
}

type Token = { kind: 'word'; value: string } | { kind: 'op'; value: string };

const CONTROL_OPS = new Set([';', '&', '&&', '|', '||', '\n']);

// Символы, которые bash экранирует обратным слешем внутри двойных кавычек.
const ESCAPABLE_IN_DOUBLE_QUOTES = '"\\$`\n';

// Дублирование дескриптора после `>&`: `>&1`, `>&2`, `>&-`, `>&3-`. Это не файл.
const DESCRIPTOR_DUP = /^(\d+-?|-)(?=[\s;&|()<>]|$)/;

function tokenize(command: string): Token[] {
  const tokens: Token[] = [];
  let word = '';
  let hasWord = false;
  let quote: '"' | "'" | null = null;
  // `$'...'`: внутри одинарных кавычек такого вида обратный слеш экранирует символ.
  let ansi = false;

  const pushWord = () => {
    if (hasWord) tokens.push({ kind: 'word', value: word });
    word = '';
    hasWord = false;
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    const next = command[i + 1];

    if (quote) {
      if (ch === quote) {
        quote = null;
        ansi = false;
      } else if (
        ch === '\\' &&
        next !== undefined &&
        quote === '"' &&
        ESCAPABLE_IN_DOUBLE_QUOTES.includes(next)
      ) {
        // В двойных кавычках `\"` — литерал, а `\<перевод строки>` — продолжение строки.
        if (next !== '\n') word += next;
        i++;
      } else if (ch === '\\' && next !== undefined && ansi) {
        word += next;
        i++;
      } else {
        word += ch;
      }
      continue;
    }
    if (ch === '$' && (next === "'" || next === '"')) {
      // `$'...'` и `$"..."`: знак `$` — часть кавычки, в слово он не попадает.
      quote = next;
      ansi = next === "'";
      hasWord = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasWord = true;
      continue;
    }
    if (ch === '\\' && next === '\n') {
      // Продолжение строки вне кавычек: оба символа исчезают.
      i++;
      continue;
    }
    if (ch === '\\' && next !== undefined) {
      word += next;
      hasWord = true;
      i++;
      continue;
    }
    if (ch === '#' && !hasWord) {
      // Комментарий до конца строки (CR-01): кавычки в нём (`# it's`) ничего не открывают.
      while (command[i + 1] !== undefined && command[i + 1] !== '\n') i++;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      pushWord();
      continue;
    }
    if (ch === '>' || (ch === '&' && next === '>')) {
      // `2>file`: номер дескриптора — часть оператора, а не слово.
      if (/^\d+$/.test(word)) {
        word = '';
        hasWord = false;
      }
      pushWord();
      const ampersandForm = ch === '&';
      if (ampersandForm) i++;
      if (command[i + 1] === '>') {
        i++;
      } else if (!ampersandForm && command[i + 1] === '|') {
        // `>|`: принудительная перезапись, цель — следующее слово.
        i++;
      } else if (!ampersandForm && command[i + 1] === '&') {
        const dup = DESCRIPTOR_DUP.exec(command.slice(i + 2));
        if (dup) {
          // `>&2`: перенаправление дескриптора, файла нет.
          i += 1 + dup[0].length;
          continue;
        }
        // `>&файл`: запись в файл.
        i++;
      }
      tokens.push({ kind: 'op', value: '>' });
      continue;
    }
    if (ch === '<') {
      pushWord();
      // `<<` (heredoc) и `<<<` (here-string) — не файл; одиночный `<` читает файл.
      let count = 1;
      while (command[i + count] === '<') count++;
      i += count - 1;
      tokens.push({ kind: 'op', value: count === 1 ? '<' : '<<' });
      continue;
    }
    if (ch === '(' || ch === ')' || ch === '`') {
      // Подоболочка, `$(...)`, `<(...)`, обратные кавычки: вложенная команда становится отдельным сегментом.
      pushWord();
      tokens.push({ kind: 'op', value: ';' });
      continue;
    }
    if ((ch === '{' || ch === '}') && !hasWord && (next === undefined || /[\s;&|()]/.test(next))) {
      // Группа `{ ...; }`: скобки — отдельные слова. Внутри слова (`a{b,c}`) остаются как есть.
      tokens.push({ kind: 'op', value: ';' });
      continue;
    }
    if (ch === ';' || ch === '\n' || ch === '|' || ch === '&') {
      pushWord();
      if ((ch === '|' || ch === '&') && next === ch) {
        tokens.push({ kind: 'op', value: ch + ch });
        i++;
      } else {
        tokens.push({ kind: 'op', value: ch });
      }
      continue;
    }
    word += ch;
    hasWord = true;
  }
  pushWord();
  return tokens;
}

// Контекст при поиске heredoc: кавычки, арифметика `$((...))` и вложенная команда `$(...)`.
type Scope =
  | { kind: 'command'; nested: boolean; parens: number }
  | { kind: 'single' }
  | { kind: 'double' }
  | { kind: 'ansi' }
  | { kind: 'arithmetic'; depth: number };

const HEREDOC_START = /<<(-?)\s*(['"]?)([\w.-]+)\2/y;

// Убирает тела heredoc (`<<EOF ... EOF`, `<<-EOF`): это данные, а не команды.
// Строка с `<<` остаётся — в ней могут быть перенаправления (`cat <<EOF > .env`).
// Маркер `<<` внутри кавычек или арифметики (`echo "<<EOF"`, `$((1<<2))`) heredoc не начинает.
function stripHeredocBodies(command: string): string {
  const kept: string[] = [];
  const pending: { delimiter: string; trimTabs: boolean }[] = [];
  const scopes: Scope[] = [{ kind: 'command', nested: false, parens: 0 }];

  for (const line of command.split('\n')) {
    const current = pending[0];
    if (current) {
      const candidate = current.trimTabs ? line.replace(/^\t+/, '') : line;
      if (candidate === current.delimiter) pending.shift();
      continue;
    }
    kept.push(line);

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      const scope = scopes[scopes.length - 1]!;

      if (scope.kind === 'single') {
        if (ch === "'") scopes.pop();
        continue;
      }
      if (scope.kind === 'ansi') {
        if (ch === '\\') i++;
        else if (ch === "'") scopes.pop();
        continue;
      }
      if (scope.kind === 'arithmetic') {
        if (ch === '(') scope.depth++;
        else if (ch === ')' && --scope.depth === 0) scopes.pop();
        continue;
      }
      if (scope.kind === 'double') {
        if (ch === '\\') i++;
        else if (ch === '"') scopes.pop();
        else if (ch === '$' && line[i + 1] === '(') {
          if (line[i + 2] === '(') scopes.push({ kind: 'arithmetic', depth: 2 });
          else scopes.push({ kind: 'command', nested: true, parens: 0 });
          i += line[i + 2] === '(' ? 2 : 1;
        }
        continue;
      }

      // Контекст команды: здесь `<<` начинает heredoc.
      if (ch === '#' && (i === 0 || /[\s;&|()]/.test(line[i - 1]!))) {
        // Комментарий до конца строки: кавычки и `<<` в нём не считаются (CR-01).
        break;
      } else if (ch === '\\') {
        i++;
      } else if (ch === "'") {
        scopes.push({ kind: 'single' });
      } else if (ch === '"') {
        scopes.push({ kind: 'double' });
      } else if (ch === '$' && line[i + 1] === "'") {
        scopes.push({ kind: 'ansi' });
        i++;
      } else if (ch === '$' && line[i + 1] === '(') {
        if (line[i + 2] === '(') scopes.push({ kind: 'arithmetic', depth: 2 });
        else scopes.push({ kind: 'command', nested: true, parens: 0 });
        i += line[i + 2] === '(' ? 2 : 1;
      } else if (ch === '(' && line[i + 1] === '(') {
        scopes.push({ kind: 'arithmetic', depth: 2 });
        i++;
      } else if (ch === '(' && scope.nested) {
        scope.parens++;
      } else if (ch === ')' && scope.nested) {
        if (scope.parens === 0) scopes.pop();
        else scope.parens--;
      } else if (ch === '<' && line[i + 1] === '<') {
        if (line[i + 2] === '<') {
          // Here-string `<<<`: не heredoc.
          i += 2;
          continue;
        }
        HEREDOC_START.lastIndex = i;
        const match = HEREDOC_START.exec(line);
        if (match) {
          pending.push({ delimiter: match[3]!, trimTabs: match[1] === '-' });
          i += match[0].length - 1;
        } else {
          i++;
        }
      }
    }
  }
  return kept.join('\n');
}

// Делит команду на простые команды по `;`, `&&`, `||`, `|`, `&` и собирает цели перенаправлений.
export function parseShell(command: string): ShellSegment[] {
  command = stripHeredocBodies(command);
  const segments: ShellSegment[] = [];
  let current: ShellSegment = { words: [], writeTargets: [], readTargets: [] };
  let pendingRedirect: string | null = null;

  for (const token of tokenize(command)) {
    if (token.kind === 'op' && CONTROL_OPS.has(token.value)) {
      segments.push(current);
      current = { words: [], writeTargets: [], readTargets: [] };
      pendingRedirect = null;
    } else if (token.kind === 'op') {
      pendingRedirect = token.value;
    } else if (pendingRedirect !== null) {
      if (pendingRedirect === '>') current.writeTargets.push(token.value);
      else if (pendingRedirect === '<') current.readTargets.push(token.value);
      pendingRedirect = null;
    } else {
      current.words.push(token.value);
    }
  }
  segments.push(current);
  return segments.filter(
    (s) => s.words.length > 0 || s.writeTargets.length > 0 || s.readTargets.length > 0,
  );
}
