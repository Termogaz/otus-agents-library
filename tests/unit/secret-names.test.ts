import { describe, expect, it } from 'vitest';
import {
  ENV_TEMPLATES,
  isEnvFileName,
  isSecretFileName,
  isSecretPath,
} from '../../.claude/hooks/lib/secret-names.js';
import { isSecretOperand } from '../../.claude/hooks/lib/secret-names.js';

describe('isSecretFileName', () => {
  it.each(['.env', '.env.local', '.env.production', '.envrc', '.env.dist', '.env*'])(
    'treats %s as secret file name',
    (name) => {
      expect(isSecretFileName(name)).toBe(true);
    },
  );

  it.each(['.env~', '.env{,}', '.env{,.local}', '.env:x', '.env#'])(
    'treats unusual env tail %s as secret file name',
    (name) => {
      expect(isSecretFileName(name)).toBe(true);
    },
  );

  it.each([
    '.env.example',
    '.env.sample',
    '.env.template',
    'env.ts',
    'README.md',
    '.env*)',
    '.env"}',
  ])('does not treat %s as secret file name', (name) => {
    expect(isSecretFileName(name)).toBe(false);
  });
});

describe('isSecretOperand', () => {
  it.each([
    'if=.env',
    'of=.env.local',
    '@.env',
    'file=@.env',
    'HEAD:.env',
    ':.env',
    '.env:x',
    '.env',
    './.env',
    '../.env',
  ])('detects secret operand %s', (arg) => {
    expect(isSecretOperand(arg)).toBe(true);
  });

  it.each(['if=out.bin', '@README.md', 'HEAD:src/app.ts', '.env.example', 'HEAD:.env.sample'])(
    'does not detect secret operand %s',
    (arg) => {
      expect(isSecretOperand(arg)).toBe(false);
    },
  );
});

describe('isSecretOperand pathspec and braces', () => {
  it.each([':(top).env', ':(glob)**/.env', ':!.env', '{.env,x}', '.{env,x}', '.e{n,m}v'])(
    'treats %s as secret operand',
    (arg) => {
      expect(isSecretOperand(arg)).toBe(true);
    },
  );

  it.each([':(top)src/app.ts', '{a,b}.txt', '.env.{example,sample}', ':!docs'])(
    'does not treat %s as secret operand',
    (arg) => {
      expect(isSecretOperand(arg)).toBe(false);
    },
  );
});

describe('isSecretPath', () => {
  it.each(['./.env', '/home/user/library/.env', '../.env', 'docs/../.env', 'config/.env.test'])(
    'detects secret path %s',
    (arg) => {
      expect(isSecretPath(arg)).toBe(true);
    },
  );

  it.each(['\\.env', './.env.example', 'src/env.ts', 'docs/environment.md'])(
    'does not detect secret path %s',
    (arg) => {
      expect(isSecretPath(arg)).toBe(false);
    },
  );
});

describe('isEnvFileName', () => {
  it.each(['.env', '.env.local', '.env.example', '.env.sample', '.env.template'])(
    'treats every env file including templates as env file name: %s',
    (name) => {
      expect(isEnvFileName(name)).toBe(true);
    },
  );

  it('does not treat ordinary file as env file name', () => {
    expect(isEnvFileName('README.md')).toBe(false);
  });
});

describe('ENV_TEMPLATES', () => {
  it('keeps exactly three env templates', () => {
    expect([...ENV_TEMPLATES].sort()).toEqual(['.env.example', '.env.sample', '.env.template']);
  });
});
