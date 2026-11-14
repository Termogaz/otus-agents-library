import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Правило NFR-3 из DESIGN.md для второго фронта (D-04): цвета и отступы только из токенов.
const ROOT = new URL('../../', import.meta.url);
const CLIENT_V2 = new URL('src/client-v2/', ROOT);

const designText = readFileSync(new URL('DESIGN.md', ROOT), 'utf8');
const stylesText = readFileSync(new URL('styles.css', CLIENT_V2), 'utf8');

function stripCssComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Блок css из раздела «Токены» DESIGN.md
function designTokensBlock(): string {
  const section = /## Токены\s+```css\n([\s\S]*?)```/.exec(designText);
  if (!section?.[1]) throw new Error('DESIGN.md: нет блока «Токены»');
  return stripCssComments(section[1]);
}

// Все блоки `@theme` и `@theme inline` из styles.css (вложенных скобок в них нет)
function themeBlocks(): string[] {
  const blocks = [...stripCssComments(stylesText).matchAll(/@theme(?:\s+inline)?\s*\{([^}]*)\}/g)];
  return blocks.map((match) => match[1] ?? '');
}

// Объявления `--<prefix>-имя: значение;` без звёздочек вида `--color-*`
function declarations(block: string, prefix: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = new RegExp(`--${prefix}-([a-z0-9-]+):\\s*([^;]+);`, 'g');
  for (const match of block.matchAll(pattern)) {
    const name = match[1];
    const value = match[2];
    if (name && value) result.set(name, value.trim().toLowerCase());
  }
  return result;
}

function singleDeclaration(block: string, name: string): string | undefined {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(block);
  return match?.[1]?.trim();
}

function sourceFiles(): { path: string; text: string }[] {
  const dir = new URL('.', CLIENT_V2);
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.(ts|tsx|css)$/.test(name))
    .map((name) => {
      const path = name.replaceAll('\\', '/');
      return { path, text: readFileSync(new URL(path, CLIENT_V2), 'utf8') };
    });
}

// Текст, где ищем классы Tailwind: весь код .ts/.tsx и строки `@apply` в .css.
// Свойства CSS (`border-color`, `text-align`) в обычных правилах классами не считаются.
function classText(file: { path: string; text: string }): string {
  if (!file.path.endsWith('.css')) return file.text;
  return file.text
    .split('\n')
    .filter((line) => line.includes('@apply'))
    .join('\n');
}

// Исходник без блоков @theme: там значения токенов объявляются, а не используются
function withoutTheme(file: { path: string; text: string }): string {
  if (!file.path.endsWith('.css')) return file.text;
  return file.text.replace(/@theme(?:\s+inline)?\s*\{[^}]*\}/g, '');
}

describe('styles.css tokens from DESIGN.md', () => {
  it('defines exactly the DESIGN.md color tokens in styles.css', () => {
    const expected = declarations(designTokensBlock(), 'color');
    const actual = new Map<string, string>();
    for (const block of themeBlocks()) {
      for (const [name, value] of declarations(block, 'color')) actual.set(name, value);
    }
    expect(expected.size).toBe(19);
    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(expected));
  });

  it('disables the default Tailwind palette', () => {
    const first = themeBlocks()[0] ?? '';
    // Первое объявление блока — сброс палитры, дальше идут только наши цвета
    expect(first.trimStart().startsWith('--color-*: initial;')).toBe(true);
  });

  it('uses the DESIGN.md font stack', () => {
    const expected = singleDeclaration(designTokensBlock(), 'font-sans');
    const actual = singleDeclaration(themeBlocks().join('\n'), 'font-sans');
    expect(expected).toBeDefined();
    expect(actual).toBe(expected);
  });

  it('matches DESIGN.md type sizes and radii', () => {
    const design = designTokensBlock();
    const theme = themeBlocks().join('\n');
    for (const name of [
      'text-sm',
      'text-base',
      'text-lg',
      'text-xl',
      'radius-control',
      'radius-card',
    ]) {
      expect(singleDeclaration(theme, name), name).toBe(singleDeclaration(design, name));
    }
  });
});

// Слова после `bg-`, `text-` и т. п., которые не называют цвет
const NON_COLOR_WORDS = new Set([
  // text-*: размер, выравнивание, перенос
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  'left',
  'right',
  'center',
  'justify',
  'start',
  'end',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
  'ellipsis',
  'clip',
  // border-*, outline-*, ring-*: стороны и стили
  't',
  'r',
  'b',
  'l',
  'x',
  'y',
  's',
  'e',
  'solid',
  'dashed',
  'dotted',
  'double',
  'hidden',
  'none',
  'collapse',
  'separate',
  'offset',
  'inset',
  // bg-*, fill-*, stroke-*: не цвет
  'cover',
  'contain',
  'top',
  'bottom',
  'fixed',
  'local',
  'scroll',
  'repeat',
  'no',
  'origin',
  'size',
  'gradient',
  'linear',
  'radial',
  'conic',
  'blend',
  'current',
  'inherit',
  'transparent',
]);

function colorTokenNames(): Set<string> {
  const names = new Set<string>();
  for (const block of themeBlocks()) {
    for (const name of declarations(block, 'color').keys()) names.add(name);
  }
  return names;
}

describe('client-v2 sources use only tokens', () => {
  it('uses colors only from tokens in client-v2 sources', () => {
    const tokens = colorTokenNames();
    const problems: string[] = [];

    for (const file of sourceFiles()) {
      const source = withoutTheme(file);
      for (const match of source.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/g)) {
        problems.push(`${file.path}: цвет вне токенов «${match[0]}»`);
      }

      const classes = classText(file);
      for (const match of classes.matchAll(/(?<![\w-])[a-z][a-z0-9-]*-\[[^\]\s]*\]/g)) {
        const value = match[0];
        if (/#[0-9a-fA-F]{3,8}|rgb|hsl|oklch|\d\s*px/.test(value)) {
          problems.push(`${file.path}: произвольное значение «${value}»`);
        }
      }
      // Суффикс класса: слова до первого сегмента с цифрой (red-500, offset-2)
      const pattern =
        /(?<![\w-])(?:bg|text|border|ring|outline|fill|stroke)-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?![\w[-])/g;
      for (const match of classes.matchAll(pattern)) {
        const suffix = match[1];
        if (!suffix) continue;
        const segments = suffix.split('-');
        const digitAt = segments.findIndex((segment) => /^\d/.test(segment));
        const words = digitAt === -1 ? segments : segments.slice(0, digitAt);
        const word = words.join('-');
        const isToken = digitAt === -1 && tokens.has(word);
        const isUtility = NON_COLOR_WORDS.has(word) || NON_COLOR_WORDS.has(words[0] ?? '');
        if (isToken || isUtility) continue;
        problems.push(`${file.path}: класс «${match[0]}» не ссылается на токен цвета`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('uses only DESIGN.md spacing steps', () => {
    const allowed = new Set(['0', '1', '2', '3', '4', '6', '8', 'auto']);
    const pattern =
      /(?<![\w-])-?(?:gap-x|gap-y|space-x|space-y|px|py|ps|pe|pt|pr|pb|pl|p|mx|my|ms|me|mt|mr|mb|ml|m|gap)-([A-Za-z0-9.[\]_%/]+)/g;
    const problems: string[] = [];

    for (const file of sourceFiles()) {
      for (const match of classText(file).matchAll(pattern)) {
        const step = match[1];
        if (step && !allowed.has(step)) {
          problems.push(`${file.path}: шаг отступа вне шкалы «${match[0]}»`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
