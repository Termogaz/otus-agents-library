import { readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Правило слоёв для src/client-v2 (D-02): из старого клиента только api.ts, сервера и Node нет,
// домен — только из адаптера демо-данных (решение автора Q1, вариант A).

const ROOT = resolve(import.meta.dirname, '../..');
const CLIENT_V2 = join(ROOT, 'src/client-v2');
const NODE_MODULES = new Set(builtinModules);

type Import = { file: string; specifier: string; target: string | null };

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

// Спецификаторы из import/export ... from '...', import '...' и import('...')
function specifiers(source: string): string[] {
  const pattern = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
  return [...source.matchAll(pattern)].map((m) => m[1] ?? '');
}

// Путь от корня репозитория без расширения для относительных импортов и псевдонима @/
function resolveTarget(file: string, specifier: string): string | null {
  let absolute: string;
  if (specifier.startsWith('.')) absolute = resolve(dirname(file), specifier);
  else if (specifier.startsWith('@/')) absolute = join(CLIENT_V2, specifier.slice(2));
  else return null;
  return relative(ROOT, absolute)
    .split(sep)
    .join('/')
    .replace(/\.(js|ts|tsx)$/, '');
}

function collectImports(): Import[] {
  return sourceFiles(CLIENT_V2).flatMap((file) =>
    specifiers(readFileSync(file, 'utf8')).map((specifier) => ({
      file: relative(ROOT, file).split(sep).join('/'),
      specifier,
      target: resolveTarget(file, specifier),
    })),
  );
}

function isInside(target: string | null, dir: string): boolean {
  return target !== null && (target === dir || target.startsWith(`${dir}/`));
}

const imports = collectImports();

describe('client-v2 layers', () => {
  it('scans the source files of client-v2', () => {
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.some((i) => i.file === 'src/client-v2/demo/demo-api.ts')).toBe(true);
  });

  it('imports from the old client only api.ts', () => {
    const bad = imports.filter(
      (i) => isInside(i.target, 'src/client') && i.target !== 'src/client/api',
    );
    expect(bad).toEqual([]);
  });

  it('does not import server code or Node built-ins', () => {
    const bad = imports.filter((i) => {
      if (isInside(i.target, 'src/server')) return true;
      const root = i.specifier.split('/')[0] ?? '';
      return (
        i.specifier.startsWith('node:') ||
        root === 'express' ||
        (!i.specifier.startsWith('.') && NODE_MODULES.has(root))
      );
    });
    expect(bad).toEqual([]);
  });

  it('imports domain only from the demo adapter', () => {
    const fromDomain = imports.filter((i) => isInside(i.target, 'src/domain'));
    const outside = fromDomain.filter((i) => !i.file.startsWith('src/client-v2/demo/'));
    expect(outside).toEqual([]);
    // Адаптер действительно берёт правила из домена, а не копирует их
    expect(fromDomain.some((i) => i.file === 'src/client-v2/demo/demo-api.ts')).toBe(true);
  });
});
