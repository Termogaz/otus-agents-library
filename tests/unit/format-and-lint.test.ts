import { describe, expect, it } from 'vitest';
import { planChecks } from '../../.claude/hooks/format-and-lint.js';

const root = '/home/user/library';

describe('planChecks', () => {
  it('formats and lints TypeScript file inside project', () => {
    expect(planChecks(`${root}/src/domain/loan.ts`, root)).toEqual({ format: true, lint: true });
  });

  it('formats and lints React component', () => {
    expect(planChecks(`${root}/src/client/App.tsx`, root)).toEqual({ format: true, lint: true });
  });

  it.each(['docs/plan.md', 'package.json', '.claude/settings.json'])(
    'formats but does not lint non-code file %s',
    (file) => {
      expect(planChecks(`${root}/${file}`, root)).toEqual({ format: true, lint: false });
    },
  );

  it.each(['/tmp/scratch.ts', '/home/user/library-other/a.ts', `${root}/node_modules/x/index.ts`])(
    'skips file outside project sources: %s',
    (file) => {
      expect(planChecks(file, root)).toEqual({ format: false, lint: false });
    },
  );
});
