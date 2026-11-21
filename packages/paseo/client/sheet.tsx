// The "more" sheet with every action of one row, and the bars above the rows that say something is off: the
// connection is being re-made, the server stopped, or the agents' `steno` does not match.
import type { PluginTheme } from '@getpaseo/plugin';
import type { PluginSubscriptionState } from '@getpaseo/plugin/client';
import { Icon, Modal } from '@getpaseo/plugin/client/ui';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Action, PanelSnapshot, Row } from '../shared/contracts';
import type { Picker } from './commands';
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

export interface RowPickerProps { picker: Picker | undefined; theme: PluginTheme; onClose(): void; onAction(row: Row, action: Action): void }

/** The things a Command Center item applies to; choosing one runs the action on it, as its row's own button would. */
export function RowPicker({ picker, theme, onClose, onAction }: RowPickerProps) {
  const { colors } = theme;
  return (
    <Modal title={picker?.title ?? ''} open={picker !== undefined} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Content contentContainerStyle={{ gap: 12 }}>
        {(picker?.sections ?? []).map(section => (
          <View key={section.key} style={{ gap: 2 }}>
            {section.title ? (
              <Text numberOfLines={1} style={{ color: colors.foregroundMuted, fontSize: 12, fontWeight: '600', paddingBottom: 2 }}>{section.title}</Text>
            ) : null}
            {section.entries.map(({ row, label, detail }) => (
              <Pressable
                key={row.key} accessibilityRole="button" accessibilityLabel={`${actionLabel(picker!.action, row)}: ${label}`}
                onPress={() => { onClose(); onAction(row, picker!.action); }}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => ({
                  flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 6, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 4,
                  backgroundColor: hovered || pressed ? colors.surface2 : 'transparent',
                })}
              >
                <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.foreground, fontSize: 14 }}>{label}</Text>
                {detail ? <Text numberOfLines={1} style={{ flexShrink: 2, color: colors.foregroundMuted, fontSize: 12 }}>{detail}</Text> : null}
              </Pressable>
            ))}
          </View>
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
