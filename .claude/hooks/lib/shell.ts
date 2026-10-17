// Упрощённый разбор shell-команды для hooks. Это эвристика, а не парсер bash:
// подстановки ($VAR, $(...)), heredoc и алиасы не раскрываются.

export interface ShellSegment {
  // Слова простой команды: имя и аргументы, без кавычек.
  words: string[];
  // Файлы, в которые идёт вывод: цели `>`, `>>`, `2>`, `&>`.
  writeTargets: string[];
}

type Token = { kind: 'word'; value: string } | { kind: 'op'; value: string };

const CONTROL_OPS = new Set([';', '&', '&&', '|', '||', '\n']);

function tokenize(command: string): Token[] {
  const tokens: Token[] = [];
  let word = '';
  let hasWord = false;
  let quote: '"' | "'" | null = null;

  const pushWord = () => {
    if (hasWord) tokens.push({ kind: 'word', value: word });
    word = '';
    hasWord = false;
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    const next = command[i + 1];

    if (quote) {
      if (ch === quote) quote = null;
      else word += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasWord = true;
      continue;
    }
    if (ch === '\\' && next !== undefined) {
      word += next;
      hasWord = true;
      i++;
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
      if (ch === '&') i++;
      if (command[i + 1] === '>') i++;
      tokens.push({ kind: 'op', value: '>' });
      continue;
    }
    if (ch === '<') {
      pushWord();
      tokens.push({ kind: 'op', value: '<' });
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

// Убирает тела heredoc (`<<EOF ... EOF`, `<<-EOF`): это данные, а не команды.
// Строка с `<<` остаётся — в ней могут быть перенаправления (`cat <<EOF > .env`).
function stripHeredocBodies(command: string): string {
  const kept: string[] = [];
  const pending: { delimiter: string; trimTabs: boolean }[] = [];

  for (const line of command.split('\n')) {
    const current = pending[0];
    if (current) {
      const candidate = current.trimTabs ? line.replace(/^\t+/, '') : line;
      if (candidate === current.delimiter) pending.shift();
      continue;
    }
    kept.push(line);
    for (const match of line.matchAll(/(?<!<)<<(-?)\s*(['"]?)([\w.-]+)\2/g)) {
      pending.push({ delimiter: match[3]!, trimTabs: match[1] === '-' });
    }
  }
  return kept.join('\n');
}

// Делит команду на простые команды по `;`, `&&`, `||`, `|`, `&` и собирает цели перенаправлений.
export function parseShell(command: string): ShellSegment[] {
  command = stripHeredocBodies(command);
  const segments: ShellSegment[] = [];
  let current: ShellSegment = { words: [], writeTargets: [] };
  let pendingRedirect: string | null = null;

  for (const token of tokenize(command)) {
    if (token.kind === 'op' && CONTROL_OPS.has(token.value)) {
      segments.push(current);
      current = { words: [], writeTargets: [] };
      pendingRedirect = null;
    } else if (token.kind === 'op') {
      pendingRedirect = token.value;
    } else if (pendingRedirect !== null) {
      if (pendingRedirect === '>') current.writeTargets.push(token.value);
      pendingRedirect = null;
    } else {
      current.words.push(token.value);
    }
  }
  segments.push(current);
  return segments.filter((s) => s.words.length > 0 || s.writeTargets.length > 0);
}
