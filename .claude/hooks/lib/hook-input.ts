import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

// Вход hook'а от Claude Code (stdin, JSON); берём только нужные поля.
const hookInputSchema = z.object({
  tool_name: z.string(),
  tool_input: z.object({
    file_path: z.string().optional(),
    command: z.string().optional(),
  }),
  cwd: z.string(),
});

export type HookInput = z.infer<typeof hookInputSchema>;

export function readHookInput(): HookInput {
  return hookInputSchema.parse(JSON.parse(readFileSync(0, 'utf8')));
}

export function projectDir(input: HookInput): string {
  return process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
}

// true, если модуль запущен как скрипт, а не импортирован тестом.
export function isMain(moduleUrl: string): boolean {
  const script = process.argv[1];
  return script !== undefined && moduleUrl === pathToFileURL(script).href;
}

// Решение `ask` для PreToolUse: Claude Code покажет причину пользователю и спросит подтверждение.
// Формат — одна строка JSON в stdout и код 0 (документация hooks Claude Code, PreToolUse).
export function exitWithAsk(reason: string): never {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exit(0);
}

// Код 2: для PreToolUse — отказ, для PostToolUse — сообщение агенту; stderr уходит агенту.
export function exitWithFeedback(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
