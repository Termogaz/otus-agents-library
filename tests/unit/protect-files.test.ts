import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkBashCommand, checkFilePath } from '../../.claude/hooks/protect-files.js';
import { checkBashDecision } from '../../.claude/hooks/protect-files.js';

const root = '/home/user/library';

describe('checkFilePath', () => {
  it.each(['.env', '.env.local', '.env.example', 'config/.env.test'])(
    'blocks writing to env file %s',
    (file) => {
      expect(checkFilePath(`${root}/${file}`)).not.toBeNull();
    },
  );

  it('blocks writing to package-lock.json', () => {
    expect(checkFilePath(`${root}/package-lock.json`)).not.toBeNull();
  });

  it('blocks writing inside .git directory', () => {
    expect(checkFilePath(`${root}/.git/config`)).not.toBeNull();
  });

  it.each(['src/domain/loan.ts', 'package.json', 'docs/environment.md', '.gitignore'])(
    'allows writing to ordinary file %s',
    (file) => {
      expect(checkFilePath(`${root}/${file}`)).toBeNull();
    },
  );
});

describe('checkBashCommand', () => {
  it.each([
    'echo SECRET=1 > .env',
    'echo SECRET=1 >> .env.local',
    'echo x >.env',
    'printf x 2> .env',
    "sed -i 's/a/b/' package-lock.json",
    'sed -i.bak s/a/b/ .env',
    'perl -pi -e s/a/b/ package-lock.json',
    'echo x | tee .env',
    'tee -a package-lock.json < input',
    'rm package-lock.json',
    'rm -f .git/index',
    'mv tmp.json package-lock.json',
    'cp .env.example .env',
    'truncate -s 0 package-lock.json',
    'npm test && echo x > .env',
    'cd src; echo x > ../.env',
    'echo x > "./.env"',
    'cat <<EOF > .env\nSECRET=1\nEOF',
    "python3 - <<'EOF'\nprint(1)\nEOF\necho x > .env",
  ])('blocks write to protected file: %s', (command) => {
    expect(checkBashCommand(command)).not.toBeNull();
  });

  it.each([
    'npm run check',
    'git status',
    'git commit -m "docs: обновить .env.example в README"',
    'grep -n lockfile package-lock.json',
    'cp .env.example /tmp/backup',
    "sed -n '1,10p' package-lock.json",
    'echo ok > docs/notes.md',
    'npm ci',
    "python3 - <<'EOF'\ntext = 'echo > .env и sed -i package-lock.json'\nEOF",
    'cat <<-END > notes.md\n\trm package-lock.json\n\tEND',
  ])('allows command that does not write protected files: %s', (command) => {
    expect(checkBashCommand(command)).toBeNull();
  });
});

describe('checkBashCommand secret reads', () => {
  it.each([
    'cat .env',
    'cat ./.env',
    'cat /home/user/library/.env',
    'cd src && cat ../.env',
    'grep x .env',
    'grep -n SECRET ./.env.local',
    'grep -e x .env',
    'grep -f .env src/a.ts',
    'rg SECRET .env.local',
    'less .env',
    'head -n 1 .env.local',
    'tail .envrc',
    'cat .env*',
    'cp .env /tmp/x',
    'source .env',
    '. ./.env',
  ])('blocks reading secret file: %s', (command) => {
    expect(checkBashCommand(command)).not.toBeNull();
  });

  it.each([
    "grep '\\.env' .planning/research/SUMMARY.md",
    'grep "\\.env" docs',
    "grep -e x '\\.env' docs",
    'cat .env.example',
    'cat ./.env.sample',
    'head .env.template',
    'cat README.md',
    'ls -la .env*',
    'test -f .env',
    'git commit -m "fix: .env parsing"',
  ])('allows reading non-secret file: %s', (command) => {
    expect(checkBashCommand(command)).toBeNull();
  });

  it.each([
    "grep '.env' src/config.ts",
    'grep -e .env src/config.ts',
    'grep -n .env docs/about.md',
    'rg -n .env docs',
    'grep -e x -e .env src',
    "egrep '.env|.envrc' README.md",
  ])('allows grep pattern that mentions env: %s', (command) => {
    expect(checkBashCommand(command)).toBeNull();
  });
});

describe('checkBashCommand input and nested shell', () => {
  it.each([
    'cat < .env',
    'while read l; do echo $l; done < .env.local',
    'bash -c "cat .env"',
    "sh -lc 'head .envrc'",
    "zsh -c 'source ./.env'",
    'grep --file=.env x',
  ])('blocks reading secret file: %s', (command) => {
    expect(checkBashCommand(command)).not.toBeNull();
  });

  it.each([
    'cat <<< .env',
    'cat <<EOF > notes.md\n.env\nEOF',
    'grep --regexp=.env src/config.ts',
    'bash -c "cat README.md"',
    'sort < input.txt',
  ])('allows input that is not a secret file: %s', (command) => {
    expect(checkBashCommand(command)).toBeNull();
  });
});

describe('checkBashCommand git add', () => {
  it.each([
    'git add -f .env',
    'git add --force .env.local',
    'git add -f .',
    'git add -fA',
    'git add --force -A',
    'git add -f config/',
    "git add -f '*.local'",
    'git add .envrc',
  ])('blocks forced git add: %s', (command) => {
    expect(checkBashCommand(command)).not.toBeNull();
  });

  it.each([
    'git add src/a.ts',
    'git add .env.example',
    'git add -A',
    'git add .',
    'git add -f dist/app.js',
  ])('allows ordinary git add: %s', (command) => {
    expect(checkBashCommand(command)).toBeNull();
  });
});

describe('checkBashDecision agent config', () => {
  it.each([
    'sed -i s/a/b/ .claude/settings.json',
    'echo x > .claude/hooks/x.ts',
    'echo x | tee .claude/settings.json',
    'cp a.json .claude/settings.json',
    'rm .claude/hooks/old.ts',
    'echo x >> ~/.claude/settings.json',
    "sh -c 'echo x > .claude/a.ts'",
  ])('asks before writing agent config: %s', (command) => {
    expect(checkBashDecision(command)?.decision).toBe('ask');
  });

  it.each([
    'cp .env .claude/x',
    'echo x > .claude/a.ts && cat .env',
    'echo x > .claude/a.ts; rm package-lock.json',
  ])('prefers deny over ask when the command also touches a secret: %s', (command) => {
    expect(checkBashDecision(command)?.decision).toBe('deny');
  });

  it.each([
    'cat .claude/settings.json',
    'ls .claude/hooks',
    'grep -n hooks .claude/settings.json',
    'git diff .claude/settings.json',
  ])('does not ask for reading agent config: %s', (command) => {
    expect(checkBashDecision(command)).toBeNull();
  });

  it('keeps checkBashCommand null for commands that only ask', () => {
    expect(checkBashCommand('sed -i s/a/b/ .claude/settings.json')).toBeNull();
  });
});

describe('protect-files hook process', () => {
  const tsx = fileURLToPath(new URL('../../node_modules/.bin/tsx', import.meta.url));
  const script = fileURLToPath(new URL('../../.claude/hooks/protect-files.ts', import.meta.url));

  // Запускает настоящий hook так же, как Claude Code: JSON на stdin, ответ — код выхода.
  function runHook(command: string) {
    const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: root });
    return spawnSync(tsx, [script], { input, encoding: 'utf8' });
  }

  it('hook process denies reading secret file with exit code 2', { timeout: 20000 }, () => {
    const result = runHook('cat ./.env');

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('.env');
  });

  it('hook process denies input redirect from secret file', { timeout: 20000 }, () => {
    const result = runHook('cat < .env');

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('.env');
  });

  it('hook process asks before writing agent config', { timeout: 20000 }, () => {
    const result = runHook('sed -i s/a/b/ .claude/settings.json');

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput: {
        hookEventName: string;
        permissionDecision: string;
        permissionDecisionReason: string;
      };
    };
    expect(output.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(output.hookSpecificOutput.permissionDecision).toBe('ask');
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain('.claude');
  });

  it('hook process lets ordinary command through', { timeout: 20000 }, () => {
    const result = runHook('cat README.md');

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
