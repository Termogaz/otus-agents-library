import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = new URL('../../.claude/skills/', import.meta.url);

type Frontmatter = Record<string, string>;

// Frontmatter skills — плоские строки `ключ: значение`; YAML-парсер ради этого не нужен.
function readFrontmatter(name: string): Frontmatter {
  const text = readFileSync(new URL(`${name}/SKILL.md`, SKILLS_DIR), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match?.[1]) throw new Error(`${name}: нет frontmatter`);
  const result: Frontmatter = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }
  return result;
}

function allowedTools(frontmatter: Frontmatter): string[] {
  const raw = frontmatter['allowed-tools'] ?? '';
  // Делим по запятой вне скобок: внутри Bash(...) запятых быть не должно, но страхуемся.
  return raw.split(/,\s*(?![^(]*\))/).filter((tool) => tool.length > 0);
}

const READ_ONLY = ['lib-check', 'lib-status'];
const EXPLICIT_ONLY = ['lib-handoff', 'lib-commit'];

describe('quick commands /lib-*', () => {
  it.each([...READ_ONLY, ...EXPLICIT_ONLY])('%s has SKILL.md with matching name', (name) => {
    expect(existsSync(new URL(`${name}/SKILL.md`, SKILLS_DIR))).toBe(true);
    const frontmatter = readFrontmatter(name);
    expect(frontmatter['name']).toBe(name);
    expect(frontmatter['description']?.length ?? 0).toBeGreaterThan(20);
    expect(allowedTools(frontmatter).length).toBeGreaterThan(0);
  });

  it.each(EXPLICIT_ONLY)('%s runs only on explicit user call', (name) => {
    expect(readFrontmatter(name)['disable-model-invocation']).toBe('true');
  });

  it.each(READ_ONLY)('%s cannot edit files or commit', (name) => {
    const tools = allowedTools(readFrontmatter(name));
    expect(tools.filter((tool) => /^(Edit|Write|NotebookEdit)\b/.test(tool))).toEqual([]);
    expect(tools.filter((tool) => /git (add|commit|push|reset|checkout)/.test(tool))).toEqual([]);
  });

  it('lib-handoff may edit only docs/memory.md', () => {
    const tools = allowedTools(readFrontmatter('lib-handoff'));
    const writers = tools.filter((tool) => /^(Edit|Write)\b/.test(tool));
    expect(writers).toEqual(['Edit(./docs/memory.md)']);
    expect(tools.filter((tool) => /git (add|commit|push)/.test(tool))).toEqual([]);
  });

  it('lib-commit cannot push, bypass hooks or edit files', () => {
    const tools = allowedTools(readFrontmatter('lib-commit'));
    expect(tools).toContain('Bash(git commit:*)');
    expect(tools).toContain('Bash(npm run check)');
    expect(tools.filter((tool) => /push|--no-verify|--amend|^(Edit|Write)\b/.test(tool))).toEqual(
      [],
    );
  });

  it.each([...READ_ONLY, ...EXPLICIT_ONLY])('%s does not grant access to env files', (name) => {
    expect(allowedTools(readFrontmatter(name)).filter((tool) => tool.includes('.env'))).toEqual([]);
  });
});
