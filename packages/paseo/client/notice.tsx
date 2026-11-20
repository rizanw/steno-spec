// A notice row, such as "No specs yet", drawn like a VS Code welcome view: the words in full and centred over one
// wide button, so the text sits on the same axis as the button it explains.
// As a one-line tree row the label and detail were cut off on both sides in a narrow panel. A notice at the top
// (the folder is not set up) stands alone and gets a heading and the accent button; one inside a section stays
// lighter, so two empty sections do not stack two loud buttons.
import type { PluginTheme } from '@getpaseo/plugin';
import { Icon } from '@getpaseo/plugin/client/ui';
import { Pressable, Text, View } from 'react-native';
import type { Action, Row } from '../shared/contracts';
import { ACTION_ICONS, actionLabel } from './model';

/** Set Up names what it sets up; the other actions read well as they are. */
const buttonLabel = (action: Action, row: Row): string => (action === 'setUp' ? 'Set Up steno' : actionLabel(action, row));

/** A notice may end in a word or a sentence; the detail reads as one, so it gets its full stop. */
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

export interface NoticeViewProps { row: Row; theme: PluginTheme; onAction(action: Action): void }

export function NoticeView({ row, theme, onAction }: NoticeViewProps) {
  const { colors } = theme;
  const top = row.depth === 0;
  const action = row.primary;
  return (
    // nested notices line up with the labels of the rows beside them, past the chevron's width
    <View style={{ gap: 8, paddingTop: top ? 16 : 4, paddingBottom: top ? 16 : 10, paddingRight: 16, paddingLeft: top ? 16 : 8 + row.depth * 14 + 20 }}>
      {top ? (
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{row.label}</Text>
      ) : (
        <Text style={{ color: colors.foreground, fontSize: 12, textAlign: 'center' }}>{row.label}</Text>
      )}
      {row.detail ? <Text style={{ color: colors.foregroundMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{sentence(row.detail)}</Text> : null}
      {action ? (
        <Pressable
          accessibilityRole="button" accessibilityLabel={buttonLabel(action, row)} onPress={() => onAction(action)}
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 5, borderRadius: 4, marginTop: 2,
            ...(top
              ? { backgroundColor: colors.accent, opacity: pressed ? 0.8 : hovered ? 0.9 : 1 }
              : { borderWidth: 1, borderColor: colors.border, backgroundColor: hovered || pressed ? colors.surface2 : 'transparent' }),
          })}
        >
          <Icon name={ACTION_ICONS[action]} size={13} color={top ? colors.accentForeground : colors.foreground} />
          <Text style={{ color: top ? colors.accentForeground : colors.foreground, fontSize: 12, fontWeight: '500' }}>{buttonLabel(action, row)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
