// `steno.call`: the skill call text for a hand-off, worded for the agent that will receive it. Claude takes a
// slash command and Codex a dollar one; any other agent gets a plain sentence, which every agent understands.
import { render, skillCall, type CallForm, type Handoff } from './vendor/host.mjs';

export type CallOutcome = { ok: true; text: string; plain: string } | { ok: false; message: string };

export function callForm(provider: string | undefined): CallForm {
  if (provider === 'claude') return 'slash';
  if (provider === 'codex') return 'dollar';
  return 'plain';
}

/** The call for `provider`, and the plain form for the clipboard; no call when core has none for this hand-off. */
export function buildCall(handoff: Handoff, provider?: string): CallOutcome {
  const call = skillCall(handoff);
  if (!call) {
    // an unsafe spec name is the other way to get here, and a spec of that name cannot exist
    const what = handoff.kind === 'steer' ? 'generating steering' : `this step of ${handoff.spec}`;
    return { ok: false, message: `steno has no skill for ${what}, so nothing was handed off.` };
  }
  return { ok: true, text: render(call, callForm(provider)), plain: render(call, 'plain') };
}
