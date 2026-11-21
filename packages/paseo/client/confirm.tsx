// The two dialogs around a change: the confirmation either reopen needs, and a refusal with its reason, each lint
// problem that blocked it, and, when the server is stopped, the way to start it again.
import type { PluginTheme } from '@getpaseo/plugin';
import { Modal } from '@getpaseo/plugin/client/ui';
import { Platform, Text, View } from 'react-native';
import type { StructuredError } from '../shared/contracts';
import { refusalProblems, reopenWording, type ChangeRequest } from './changes';
import { Button } from './row';

// iOS has no font called monospace
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export interface ReopenConfirmProps { request: ChangeRequest | undefined; theme: PluginTheme; onAnswer(reopen: boolean): void }

export function ReopenConfirm({ request, theme, onAnswer }: ReopenConfirmProps) {
  const wording = request ? reopenWording(request) : { title: '', body: '' };
  return (
    <Modal title={wording.title} open={request !== undefined} onOpenChange={open => { if (!open) onAnswer(false); }}>
      <Modal.Content>
        <Text style={{ color: theme.colors.foreground }}>{wording.body}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Button label="Cancel" theme={theme} onPress={() => onAnswer(false)} />
          <Button label="Reopen" theme={theme} primary onPress={() => onAnswer(true)} />
        </View>
      </Modal.Content>
    </Modal>
  );
}

export interface RefusalProps { error: StructuredError | undefined; stopped: boolean; theme: PluginTheme; onClose(): void; onRestart(): void }

/**
 * A refusal as a dialog rather than a toast: a toast holds one line and no button, and a lint block needs every
 * problem listed, a stopped server the Restart button.
 */
export function Refusal({ error, stopped, theme, onClose, onRestart }: RefusalProps) {
  const problems = error ? refusalProblems(error) : [];
  return (
    <Modal title="Nothing changed" open={error !== undefined} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Content>
        <Text style={{ color: theme.colors.foreground }}>{error?.message ?? ''}</Text>
        {problems.map(line => (
          <Text key={line} selectable style={{ color: theme.colors.foregroundMuted, fontFamily: MONO, fontSize: 12 }}>{line}</Text>
        ))}
        {stopped ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button label="Restart steno Server" theme={theme} primary onPress={() => { onClose(); onRestart(); }} />
          </View>
        ) : null}
      </Modal.Content>
    </Modal>
  );
}
