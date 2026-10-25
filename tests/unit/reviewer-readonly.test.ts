import { describe, expect, it } from 'vitest';
import { checkReviewerCommand } from '../../.claude/hooks/reviewer-readonly.js';

describe('checkReviewerCommand', () => {
  it.each([
    'git status --short',
    "git log --format='%h %s%n%b' main..HEAD",
    'git diff main...HEAD --stat',
    'git diff main...HEAD',
    'git show ee6b114:docs/plan.md',
    'git branch',
    'git branch --show-current',
    'npm run check',
    'env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY npm run test:e2e',
    'ls -la .claude',
  ])('allows read-only command: %s', (command) => {
    expect(checkReviewerCommand(command)).toBeNull();
  });

  it.each([
    "sed -i 's/a/b/' AGENTS.md",
    'git commit -m fix',
    'git checkout main',
    'git branch -D feat/skills',
    'git diff --output=patch.diff',
    'npm run format',
    'npm install',
    'git status > status.txt',
    'git diff; rm AGENTS.md',
    'git log && git push',
    'git log | tee log.txt',
    'git show $(touch x)',
    'git show `touch x`',
    'rm AGENTS.md',
  ])('blocks command that may change files: %s', (command) => {
    expect(checkReviewerCommand(command)).not.toBeNull();
  });

  it.each([
    'cat .env',
    'cat ./.env.local',
    'head -n 5 .env',
    'tail .envrc',
    'wc -l .env',
    'cat docs/../.env',
    'cat /home/user/library/.env',
  ])('blocks reading secret file: %s', (command) => {
    expect(checkReviewerCommand(command)).not.toBeNull();
  });

  it.each(['cat .env.example', 'cat README.md', 'head -n 5 package.json', 'ls -la .env*'])(
    'allows reading non-secret file: %s',
    (command) => {
      expect(checkReviewerCommand(command)).toBeNull();
    },
  );
});

describe('git read operands', () => {
  it.each([
    'git diff --no-index /dev/null .env',
    'git show HEAD:.env',
    'git show :.env',
    'git log -p -- .env',
    'git diff HEAD .env',
    'git show HEAD:.env.local',
  ])('blocks git read of secret file: %s', (command) => {
    expect(checkReviewerCommand(command)).not.toBeNull();
  });

  it.each(["git show ':(top).env'", "git log -p -- ':(top).env'", 'cat {.env,x}', 'cat .{env,x}'])(
    'blocks pathspec magic and braces around secret: %s',
    (command) => {
      expect(checkReviewerCommand(command)).not.toBeNull();
    },
  );

  it.each(['git diff --no-index /dev/null README.md'])(
    'blocks git --no-index entirely: %s',
    (command) => {
      expect(checkReviewerCommand(command)).not.toBeNull();
    },
  );

  it.each([
    'git diff main...HEAD',
    'git show ee6b114:docs/plan.md',
    'git log --oneline',
    'git status --short',
    'git diff main...HEAD --stat',
  ])('allows ordinary git read: %s', (command) => {
    expect(checkReviewerCommand(command)).toBeNull();
  });
});
