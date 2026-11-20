// The New Agent screens that are open. Paseo resolves `composers(...)` for running agents only, so a draft's
// message box is reachable only from inside it: this composer item renders nothing and records the composer it
// sits in while that composer is a draft. A draft does not say which workspace it belongs to, so the hand-off uses
// one only when it is the only draft open.
import { useComposer, type PluginComposer } from '@getpaseo/plugin/client';
import { useEffect, useRef } from 'react';

/** Each mounted draft composer, read through a ref so a hand-off always gets its latest state. */
const open = new Set<{ current: PluginComposer }>();

export function openDrafts(): PluginComposer[] {
  return [...open].map(entry => entry.current).filter(c => c.context === 'draft');
}

export function DraftProbe() {
  const composer = useComposer();
  const entry = useRef({ current: composer }).current;
  entry.current = composer;
  useEffect(() => {
    open.add(entry);
    return () => { open.delete(entry); };
  }, [entry]);
  return null;
}
