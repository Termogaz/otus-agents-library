import { describe, expect, it } from 'vitest';
import { parseShell } from '../../.claude/hooks/lib/shell.js';

// Слова всех сегментов одним списком — удобно проверять, что имя файла стало видимым.
function allWords(command: string): string[] {
  return parseShell(command).flatMap((s) => s.words);
}

describe('parseShell tokenizer', () => {
  it('tokenizes escaped quote inside double quotes', () => {
    const segments = parseShell('echo "\\""; cat .env');

    expect(segments).toHaveLength(2);
    expect(segments[0]!.words).toEqual(['echo', '"']);
    expect(segments[1]!.words).toEqual(['cat', '.env']);
  });

  it('keeps escaped quote as a literal char of the word', () => {
    const segments = parseShell('echo "a\\"b" > ok.txt');

    expect(segments).toHaveLength(1);
    expect(segments[0]!.words).toEqual(['echo', 'a"b']);
    expect(segments[0]!.writeTargets).toEqual(['ok.txt']);
  });

  it('keeps backslash before ordinary char inside double quotes', () => {
    expect(allWords('grep "\\.x" docs')).toEqual(['grep', '\\.x', 'docs']);
  });

  it('captures clobber and dup-to-file redirect targets', () => {
    expect(parseShell('echo x >| .env')[0]!.writeTargets).toContain('.env');
    expect(parseShell('echo x >& .env')[0]!.writeTargets).toContain('.env');
    expect(parseShell('echo x >&.env')[0]!.writeTargets).toContain('.env');
  });

  it('does not treat descriptor duplication as a file target', () => {
    expect(parseShell('ls >&2')[0]!.writeTargets).toEqual([]);
    expect(parseShell('cmd >&1')[0]!.writeTargets).toEqual([]);
    expect(parseShell('cmd 2>&1')[0]!.writeTargets).toEqual([]);
    expect(parseShell('cmd >&-')[0]!.writeTargets).toEqual([]);
  });

  it('folds line continuation', () => {
    expect(allWords('cat \\\n.env')).toEqual(['cat', '.env']);
    expect(allWords('ca\\\nt .env')).toEqual(['cat', '.env']);
  });

  it('strips ansi-c and localized quote prefix', () => {
    expect(allWords("cat $'.env'")).toEqual(['cat', '.env']);
    expect(allWords('cat $".env"')).toEqual(['cat', '.env']);
  });

  it('splits subshell and grouping into separate segments', () => {
    expect(parseShell('(cat .env)').map((s) => s.words)).toContainEqual(['cat', '.env']);
    expect(parseShell('(rm .env)').map((s) => s.words)).toContainEqual(['rm', '.env']);
    expect(allWords('{ rm .git/index; }')).toContain('.git/index');
  });

  it('splits process substitution into a nested command segment', () => {
    const segments = parseShell('cat <(cat .env)');

    expect(segments.some((s) => s.words.includes('.env'))).toBe(true);
  });

  it('keeps braces inside a word', () => {
    expect(allWords('echo a{b,c}')).toEqual(['echo', 'a{b,c}']);
    expect(allWords('cat .env{,}')).toEqual(['cat', '.env{,}']);
  });

  it('ignores heredoc marker inside quotes and arithmetic', () => {
    expect(allWords('echo "<<EOF"\ncat .env')).toContain('.env');
    expect(allWords("echo '<<EOF'\ncat .env")).toContain('.env');
    expect(allWords('x=$((1<<2))\ncat .env')).toContain('.env');
  });

  it('keeps existing heredoc redirect behavior', () => {
    const redirected = parseShell('cat <<EOF > .env\nSECRET=1\nEOF');
    expect(redirected.flatMap((s) => s.writeTargets)).toContain('.env');

    const bodyHidden = parseShell('cat <<-END > notes.md\n\trm package-lock.json\n\tEND');
    expect(bodyHidden.flatMap((s) => s.words)).not.toContain('package-lock.json');

    const quotedDelimiter = parseShell("python3 - <<'EOF'\nprint(1)\nEOF\necho x > .env");
    expect(quotedDelimiter.flatMap((s) => s.writeTargets)).toContain('.env');
  });

  it('keeps existing redirect and input behavior', () => {
    expect(parseShell('echo x 2> out.log')[0]!.writeTargets).toEqual(['out.log']);
    expect(parseShell('echo x &> out.log')[0]!.writeTargets).toEqual(['out.log']);
    expect(parseShell('sort < input.txt')[0]!.readTargets).toEqual(['input.txt']);
    expect(parseShell('cat <<< word')[0]!.readTargets).toEqual([]);
  });
});
