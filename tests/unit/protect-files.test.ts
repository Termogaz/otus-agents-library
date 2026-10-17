import { describe, expect, it } from 'vitest';
import { checkBashCommand, checkFilePath } from '../../.claude/hooks/protect-files.js';

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
