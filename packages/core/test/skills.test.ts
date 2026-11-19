import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const skillsDir = join(__dirname, '..', '..', 'skills', 'skills');
const read = (name: string) => readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');

// The editor calls these skills with a spec name, so each one has to work on just that spec.
describe('skills accept a spec name', () => {
  const called = ['steno-brainstorm', 'steno-spec', 'steno-design', 'steno-tasks', 'steno-review', 'steno-run'];

  it.each(called)('%s has a Spec name section that appends the name to steno commands', name => {
    const text = read(name);
    expect(text).toMatch(/^## Spec name$/m);
    const section = text.split(/^## Spec name$/m)[1].split(/^## /m)[0];
    expect(section).toContain('append the spec name to every steno command');
  });

  it('keeps the spec name off steno new and steno quick', () => {
    for (const name of ['steno-brainstorm', 'steno-spec', 'steno-design', 'steno-tasks']) {
      const section = read(name).split(/^## Spec name$/m)[1].split(/^## /m)[0];
      expect(section).toContain('never to `steno new` or `steno quick`');
    }
  });

  it('steno-review reads the stage first, then the spec name', () => {
    const section = read('steno-review').split(/^## Spec name$/m)[1].split(/^## /m)[0];
    expect(section).toMatch(/stage first, then .*spec name/);
    expect(section).toContain('the first word is the stage');
  });
});
