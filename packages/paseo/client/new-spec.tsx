// The New Spec form. The name is checked by the CLI alone, so the form shows the CLI's own reason when it refuses
// one, and stays open with what the user typed.
import type { PluginTheme } from '@getpaseo/plugin';
import { useRpc } from '@getpaseo/plugin/client';
import { Modal, SettingsInput, SettingsSelect } from '@getpaseo/plugin/client/ui';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { newSpec, type Handoff } from '../shared/contracts';
import { creationHandoff, type Writer } from './handoff';
import { Button } from './row';

type Kind = 'feature' | 'bugfix';

const KINDS = [{ value: 'feature', label: 'Feature' }, { value: 'bugfix', label: 'Bugfix' }] as const;
const WRITERS = [
  { value: 'agent', label: 'An agent writes it' },
  { value: 'brainstorm', label: 'Brainstorm it with an agent first' },
  { value: 'me', label: 'I write it myself' },
] as const;

export interface NewSpecFormProps {
  open: boolean; workspaceId: string; theme: PluginTheme;
  onClose(): void;
  /** After creation: the spec made, and the hand-off of its first stage when an agent writes it. */
  onCreated(spec: string, handoff: Handoff | undefined): void;
}

export function NewSpecForm({ open, ...rest }: NewSpecFormProps) {
  // mounted only while open, so each New Spec starts from an empty form
  return (
    <Modal title="New Spec" open={open} onOpenChange={o => { if (!o) rest.onClose(); }}>
      {open ? <Form {...rest} /> : null}
    </Modal>
  );
}

function Form({ workspaceId, theme, onClose, onCreated }: Omit<NewSpecFormProps, 'open'>) {
  const send = useRpc(newSpec);
  const [kind, setKind] = useState<Kind>('feature');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [writer, setWriter] = useState<Writer>('agent');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const create = () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    send({ workspaceId, kind, name: name.trim(), writer, ...(title.trim() ? { title: title.trim() } : {}), ...(description.trim() ? { description: description.trim() } : {}) })
      .then(outcome => {
        if (!outcome.ok) { setError(outcome.error.message); return; }
        const spec = outcome.spec ?? name.trim();
        onCreated(spec, creationHandoff(writer, spec, outcome.phase));
      }, err => setError(String(err)))
      .finally(() => setBusy(false));
  };

  return (
    <Modal.Content>
      <SettingsSelect<Kind> label="Kind" value={kind} options={KINDS} onValueChange={setKind} />
      <SettingsInput label="Name" hint="kebab-case, such as login-rate-limit" placeholder="my-feature" onChangeText={setName} />
      <SettingsInput label="Title" hint="Optional" onChangeText={setTitle} />
      <SettingsSelect<Writer> label="Who writes it" value={writer} options={WRITERS} onValueChange={setWriter} />
      <SettingsInput label="Description" hint="Optional: what it is for, in a sentence or two" onChangeText={setDescription} />
      {error ? <Text selectable style={{ color: theme.colors.statusDanger }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Button label="Cancel" theme={theme} onPress={onClose} />
        <Button label={busy ? 'Creating…' : 'Create'} theme={theme} primary onPress={create} />
      </View>
    </Modal.Content>
  );
}
