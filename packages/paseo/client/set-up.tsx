// The Set Up form: which coding agents get the steno skills. The list comes from the bundled CLI, so it names
// exactly the agents `steno init` knows; choosing none installs only the shared skills folder.
import type { PluginTheme } from '@getpaseo/plugin';
import { useRpc } from '@getpaseo/plugin/client';
import { Loading, Modal, SettingsSwitch } from '@getpaseo/plugin/client/ui';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { listAgents, setUp } from '../shared/contracts';
import { Button } from './row';

/** `onDone` gets the chosen agents by name, for the toast. */
export interface SetUpFormProps { open: boolean; workspaceId: string; theme: PluginTheme; onClose(): void; onDone(agents: string[]): void }

export function SetUpForm({ open, ...rest }: SetUpFormProps) {
  return (
    <Modal title="Set Up steno" open={open} onOpenChange={o => { if (!o) rest.onClose(); }}>
      {open ? <Form {...rest} /> : null}
    </Modal>
  );
}

function Form({ workspaceId, theme, onClose, onDone }: Omit<SetUpFormProps, 'open'>) {
  const list = useRpc(listAgents);
  const send = useRpc(setUp);
  const [agents, setAgents] = useState<{ key: string; label: string }[]>();
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    list({ workspaceId }).then(r => { if (live) setAgents(r.agents); }, err => { if (live) { setAgents([]); setError(String(err)); } });
    return () => { live = false; };
  }, [list, workspaceId]);

  const toggle = (key: string, on: boolean) => setChosen(c => (on ? [...c, key] : c.filter(k => k !== key)));

  const run = () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    send({ workspaceId, agents: chosen }).then(
      outcome => (outcome.ok ? onDone(agents!.filter(a => chosen.includes(a.key)).map(a => a.label)) : setError(outcome.error.message)),
      err => setError(String(err)),
    ).finally(() => setBusy(false));
  };

  if (!agents) return <Modal.Content><Loading /></Modal.Content>;
  return (
    <Modal.Content>
      <Text style={{ color: theme.colors.foreground }}>Which coding agents get the steno skills? With none chosen, steno installs only the shared skills folder.</Text>
      {agents.map(agent => (
        <SettingsSwitch key={agent.key} label={agent.label} value={chosen.includes(agent.key)} onValueChange={on => toggle(agent.key, on)} />
      ))}
      {error ? <Text selectable style={{ color: theme.colors.statusDanger }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Button label="Cancel" theme={theme} onPress={onClose} />
        <Button label={busy ? 'Setting up…' : 'Set Up'} theme={theme} primary onPress={run} />
      </View>
    </Modal.Content>
  );
}
