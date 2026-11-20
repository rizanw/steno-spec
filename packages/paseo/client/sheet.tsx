// The "more" sheet with every action of one row, and the bars above the rows that say something is off: the
// connection is being re-made, the server stopped, or the agents' `steno` does not match.
import type { PluginTheme } from '@getpaseo/plugin';
import type { PluginSubscriptionState } from '@getpaseo/plugin/client';
import { Icon, Modal } from '@getpaseo/plugin/client/ui';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Action, PanelSnapshot, Row } from '../shared/contracts';
import { actionLabel, INSTALL_COMMAND } from './model';
import { Button } from './row';

export interface ActionSheetProps { row: Row | undefined; theme: PluginTheme; onClose(): void; onAction(row: Row, action: Action): void }

/** A modal on desktop and a bottom sheet in a narrow window, so both offer the same actions. */
export function ActionSheet({ row, theme, onClose, onAction }: ActionSheetProps) {
  return (
    <Modal title={row?.label ?? ''} open={row !== undefined} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Content>
        {(row?.actions ?? []).map(action => (
          <Pressable
            key={action} accessibilityRole="button" accessibilityLabel={actionLabel(action, row)}
            onPress={() => { onClose(); onAction(row!, action); }} style={{ paddingVertical: 10 }}
          >
            <Text style={{ color: theme.colors.foreground, fontSize: 15 }}>{actionLabel(action, row)}</Text>
          </Pressable>
        ))}
      </Modal.Content>
    </Modal>
  );
}

/** What a Command Center intent asks the user to pick: the action and the rows that offer it. */
export interface RowPick { action: Action; rows: Row[] }

export interface RowPickerProps { pick: RowPick | undefined; theme: PluginTheme; onClose(): void; onAction(row: Row, action: Action): void }

/** The rows an intent applies to; tapping one runs the action on it, as its own button would. */
export function RowPicker({ pick, theme, onClose, onAction }: RowPickerProps) {
  const { colors } = theme;
  return (
    <Modal title={pick ? `${actionLabel(pick.action, undefined)}: pick a row` : ''} open={pick !== undefined} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Content>
        {(pick?.rows ?? []).map(row => (
          <Pressable
            key={row.key} accessibilityRole="button" accessibilityLabel={`${actionLabel(pick!.action, row)} ${row.label}`}
            onPress={() => { onClose(); onAction(row, pick!.action); }} style={{ paddingVertical: 8, gap: 2 }}
          >
            <Text style={{ color: colors.foreground, fontSize: 15 }}>{row.label}</Text>
            <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>
              {[row.target?.spec !== row.label ? row.target?.spec : undefined, actionLabel(pick!.action, row), row.detail].filter(Boolean).join(' · ')}
            </Text>
          </Pressable>
        ))}
      </Modal.Content>
    </Modal>
  );
}

function Bar({ theme, color, icon, text, children }: { theme: PluginTheme; color: string; icon: string; text: string; children?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 8, borderBottomWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }}>
      <Icon name={icon} size={14} color={color} />
      <Text style={{ flexShrink: 1, color: theme.colors.foreground, fontSize: 12 }}>{text}</Text>
      {children}
    </View>
  );
}

export interface StatusBarsProps { snapshot: PanelSnapshot | undefined; state: PluginSubscriptionState; theme: PluginTheme; onRestart(): void }

export function StatusBars({ snapshot, state, theme, onRestart }: StatusBarsProps) {
  const { colors } = theme;
  const bars: ReactNode[] = [];
  // before the first snapshot the panel shows Paseo's loading state instead
  if (snapshot && state.status !== 'live') bars.push(<Bar key="reconnecting" theme={theme} color={colors.foregroundMuted} icon="RefreshCw" text="Reconnecting…" />);
  if (snapshot?.server === 'stopped') {
    bars.push(
      <Bar key="stopped" theme={theme} color={colors.statusDanger} icon="CircleStop" text="The steno server stopped after crashing repeatedly.">
        <Button label="Restart steno Server" theme={theme} primary onPress={onRestart} />
      </Bar>,
    );
  }
  if (snapshot && !snapshot.agentSteno.matches) {
    const text = snapshot.agentSteno.found
      ? `The steno your coding agents run speaks ${snapshot.agentSteno.protocol === undefined ? 'an unknown protocol' : `protocol ${snapshot.agentSteno.protocol}`}, not this plugin's. Install the current one: ${INSTALL_COMMAND}`
      : `Your coding agents have no steno command. Install it: ${INSTALL_COMMAND}`;
    bars.push(<Bar key="agent-steno" theme={theme} color={colors.statusWarning} icon="TriangleAlert" text={text} />);
  }
  return <>{bars}</>;
}
