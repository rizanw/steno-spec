// The tree fetcher: one fetch in flight, notices during it folded into one more, a failed fetch keeping the last
// tree, and nothing loaded or applied once the folder closed.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TreeFetcher } from '../../src/host/fetch.js';

/** Let every queued microtask run, as the event loop would between notices. */
const settle = () => new Promise(resolve => setImmediate(resolve));

type Outcome = { kind: 'tree'; tree: number } | { kind: 'throw' } | { kind: 'empty' };
type Step = { kind: 'notice' } | { kind: 'finish'; outcome: Outcome } | { kind: 'dispose' };
type Event = { kind: 'notice' | 'load' | 'dispose' } | { kind: 'apply'; tree: number };

/**
 * A fetcher whose fetches wait until the test finishes them, with a log of every notice, load start, apply and
 * dispose in the order they happened. `overlap` turns true if a load starts while another is still out.
 */
function harness() {
  const log: Event[] = [];
  let pending: ((o: Outcome) => void) | undefined;
  let overlap = false;
  const loaded: Outcome[] = [];
  const fetcher = new TreeFetcher<number>(
    () => {
      if (pending) overlap = true;
      log.push({ kind: 'load' });
      return new Promise<number | undefined>((resolve, reject) => {
        pending = o => {
          pending = undefined;
          loaded.push(o);
          if (o.kind === 'tree') resolve(o.tree);
          else if (o.kind === 'throw') reject(new Error('server went away'));
          else resolve(undefined);
        };
      });
    },
    tree => log.push({ kind: 'apply', tree }),
  );
  const step = async (s: Step) => {
    if (s.kind === 'notice') { log.push({ kind: 'notice' }); fetcher.request(); }
    else if (s.kind === 'dispose') { log.push({ kind: 'dispose' }); fetcher.dispose(); }
    else pending?.(s.outcome);
    await settle();
  };
  /** Finish whatever is still out, so every owed fetch gets its chance to start. */
  const drain = async () => { for (let i = 0; pending && i < 100; i++) { pending({ kind: 'tree', tree: -1 - i }); await settle(); } };
  return { log, loaded, step, drain, overlap: () => overlap };
}

const outcome: fc.Arbitrary<Outcome> = fc.oneof(
  fc.nat().map(tree => ({ kind: 'tree' as const, tree })),
  fc.constant({ kind: 'throw' as const }),
  fc.constant({ kind: 'empty' as const }),
);
const step: fc.Arbitrary<Step> = fc.oneof(
  fc.constant({ kind: 'notice' as const }),
  outcome.map(o => ({ kind: 'finish' as const, outcome: o })),
);
/** Steps with at most one dispose dropped in somewhere. */
const script: fc.Arbitrary<Step[]> = fc.tuple(fc.array(step, { maxLength: 30 }), fc.option(fc.nat()))
  .map(([steps, at]) => at === null ? steps : [...steps.slice(0, at % (steps.length + 1)), { kind: 'dispose' as const }, ...steps.slice(at % (steps.length + 1))]);

describe('TreeFetcher', () => {
  it('runs one load at a time, serves every notice, and does nothing after dispose', async () => {
    await fc.assert(fc.asyncProperty(script, async steps => {
      const h = harness();
      for (const s of steps) await h.step(s);
      await h.drain();
      expect(h.overlap()).toBe(false);
      const kinds = h.log.map(e => e.kind);
      const disposedAt = kinds.indexOf('dispose');
      if (disposedAt >= 0) expect(kinds.slice(disposedAt + 1).filter(k => k === 'load' || k === 'apply')).toEqual([]);
      kinds.forEach((k, i) => {
        if (k !== 'notice' || (disposedAt >= 0 && disposedAt < i)) return;
        // a notice before dispose is served by a later load, unless dispose came first
        const served = kinds.slice(i + 1).includes('load') || disposedAt > i;
        expect(served, `notice at ${i} in ${kinds.join(' ')}`).toBe(true);
      });
    }));
  });

  it('hands apply the result of the latest fetch that succeeded', async () => {
    await fc.assert(fc.asyncProperty(fc.array(step, { maxLength: 30 }), async steps => {
      const h = harness();
      for (const s of steps) await h.step(s);
      const applied = h.log.flatMap(e => e.kind === 'apply' ? [e.tree] : []);
      const succeeded = h.loaded.flatMap(o => o.kind === 'tree' ? [o.tree] : []);
      expect(applied.at(-1)).toBe(succeeded.at(-1));
    }));
  });

  it('keeps one fetch in flight and collapses the notices that arrive during it', async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const applied: number[] = [];
    const f = new TreeFetcher<object>(
      () => { calls++; return new Promise(res => { release = () => res({}); }); },
      () => applied.push(calls),
    );
    f.request();
    await settle();
    expect(calls).toBe(1);
    f.request(); f.request(); f.request();   // three notices while the first fetch is out
    expect(calls).toBe(1);
    release!();
    await settle();
    expect(calls).toBe(2);                   // exactly one more, not three
    release!();
    await settle();
    expect(calls).toBe(2);
    expect(applied).toEqual([1, 2]);
  });

  it('leaves the last tree in place when a fetch fails, and serves the next notice', async () => {
    let calls = 0;
    const applied: object[] = [];
    const f = new TreeFetcher<object>(
      async () => { if (++calls === 1) throw new Error('server went away'); return {}; },
      t => applied.push(t),
    );
    f.request();
    await settle();
    expect(applied).toHaveLength(0);
    f.request();
    await settle();
    expect(applied).toHaveLength(1);
  });

  it('treats an empty or null answer as a failed fetch', async () => {
    const answers: (object | null | undefined)[] = [undefined, null];
    const applied: unknown[] = [];
    const f = new TreeFetcher<object>(async () => answers.shift() as object | undefined, t => applied.push(t));
    f.request(); await settle();
    f.request(); await settle();
    expect(applied).toEqual([]);
  });

  it('drops the owed fetch and the answer in flight once disposed', async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const applied: object[] = [];
    const f = new TreeFetcher<object>(
      () => { calls++; return new Promise(res => { release = () => res({}); }); },
      t => applied.push(t),
    );
    f.request();
    f.request();                             // owed
    f.dispose();
    release!();
    await settle();
    f.request();
    await settle();
    expect(calls).toBe(1);
    expect(applied).toEqual([]);
  });
});
