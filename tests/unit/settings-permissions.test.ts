import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const hookEntrySchema = z.object({
  matcher: z.string(),
  hooks: z.array(z.object({ command: z.string() })),
});

// Схема сужает только нужные поля settings.json; остальное игнорируется.
const settingsSchema = z.object({
  permissions: z.object({
    defaultMode: z.string(),
    allow: z.array(z.string()),
    ask: z.array(z.string()),
    deny: z.array(z.string()),
  }),
  hooks: z.object({
    SessionStart: z.array(hookEntrySchema),
    PreCompact: z.array(hookEntrySchema),
    PreToolUse: z.array(hookEntrySchema),
  }),
});

const settings = settingsSchema.parse(
  JSON.parse(readFileSync(new URL('../../.claude/settings.json', import.meta.url), 'utf8')),
);
const { allow, ask, deny, defaultMode } = settings.permissions;

describe('settings.json permissions', () => {
  it('denies reading env files at any depth', () => {
    expect(deny).toContain('Read(**/.env*)');
    expect(deny).toContain('Read(./.env*)');
  });

  it('denies shell reads of env files', () => {
    const expected = [
      'Bash(cat .env*)',
      'Bash(head .env*)',
      'Bash(tail .env*)',
      'Bash(cat ./.env*)',
      'Bash(head ./.env*)',
      'Bash(tail ./.env*)',
      'Bash(less .env*)',
      'Bash(less ./.env*)',
      'Bash(more .env*)',
      'Bash(more ./.env*)',
      'Bash(source .env*)',
      'Bash(source ./.env*)',
    ];
    for (const rule of expected) {
      expect(deny).toContain(rule);
    }
  });

  it('does not deny grep patterns by prefix', () => {
    // Префиксный шаблон не отличает шаблон поиска от пути: такой deny резал бы
    // безобидный поиск по тексту; чтение .env через grep закрывает hook protect-files.
    expect(deny.filter((rule) => rule.startsWith('Bash(grep'))).toEqual([]);
  });

  it('asks before editing agent config under .claude', () => {
    expect(ask).toContain('Edit(./.claude/**)');
  });

  it('does not pre-approve edits under .claude', () => {
    const risky = allow.filter(
      (rule) => (rule.startsWith('Edit(') || rule.startsWith('Write(')) && rule.includes('.claude'),
    );
    expect(risky).toEqual([]);
  });

  it('keeps acceptEdits as default mode', () => {
    expect(defaultMode).toBe('acceptEdits');
  });

  it('keeps protect-files hook on Edit, Write and Bash', () => {
    const entry = settings.hooks.PreToolUse.find((item) => item.matcher === 'Edit|Write|Bash');
    expect(entry).toBeDefined();
    expect(entry?.hooks.some((hook) => hook.command.includes('protect-files.ts'))).toBe(true);
  });

  it('runs session-start digest on startup, resume, clear and compact', () => {
    const entry = settings.hooks.SessionStart.find((item) =>
      item.hooks.some((hook) => hook.command.includes('session-start.ts')),
    );
    expect(entry?.matcher).toBe('startup|resume|clear|compact');
  });

  it('writes checkpoint before manual and auto compaction', () => {
    const entry = settings.hooks.PreCompact.find((item) =>
      item.hooks.some((hook) => hook.command.includes('pre-compact.ts')),
    );
    expect(entry?.matcher).toBe('manual|auto');
  });

  it('asks before git push', () => {
    expect(ask).toContain('Bash(git push:*)');
    expect(deny).toContain('Bash(git push --force:*)');
  });
});
