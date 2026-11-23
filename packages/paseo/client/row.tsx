// One line of the panel, and the button every part of the panel uses. Colours come only from Paseo's theme, so
// the panel follows the user's theme, dark or light.
import type { PluginTheme } from '@getpaseo/plugin';
import { Icon } from '@getpaseo/plugin/client/ui';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Action, Row } from '../shared/contracts';
import { ACTION_ICONS, actionLabel, needsMore, ROW_ICONS, rowButtons } from './model';
import { NoticeView } from './notice';

/** A labelled button, for dialogs and status bars where a word says more than an icon. */
export interface ButtonProps { label: string; theme: PluginTheme; onPress(): void; primary?: boolean }

export function Button({ label, theme, onPress, primary }: ButtonProps) {
  const color = primary ? theme.colors.accentForeground : theme.colors.foreground;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: primary ? theme.colors.accent : theme.colors.surface2 }}
    >
      <Text style={{ color, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

/** How long a long-press keeps the label up on a touch screen, where there is no hover. */
const HINT_MS = 1_500;

export interface IconButtonProps { icon: string; label: string; theme: PluginTheme; onPress(): void }

/**
 * A small icon button, as VS Code draws a tree row's inline actions. Paseo's kit has no tooltip, so the button
 * draws its own label on hover, and on a long-press for touch screens. The label sits to the button's left:
 * these buttons end the row, so the label never runs off the panel's edge, and it stays within the row's height,
 * where the list does not clip it.
 */
function IconButton({ icon, label, theme, onPress }: IconButtonProps) {
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const showFor = (ms: number) => { setHint(true); clearTimeout(timer.current); timer.current = setTimeout(() => setHint(false), ms); };
  return (
    <View style={{ position: 'relative', flexShrink: 0, zIndex: hint ? 1 : 0 }}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={label} onPress={() => { setHint(false); onPress(); }} hitSlop={6}
        onHoverIn={() => { clearTimeout(timer.current); setHint(true); }} onHoverOut={() => setHint(false)}
        onLongPress={() => showFor(HINT_MS)}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => ({ padding: 4, borderRadius: 4, backgroundColor: hovered || pressed ? theme.colors.surface2 : 'transparent' })}
      >
        <Icon name={icon} size={14} color={theme.colors.foregroundMuted} />
      </Pressable>
      {hint ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: '100%', top: 0, bottom: 0, justifyContent: 'center', marginRight: 4 }}>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }}>
            <Text numberOfLines={1} style={{ color: theme.colors.foreground, fontSize: 11 }}>{label}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** A row action as an icon button, named the same as in the "more" sheet. */
export function ActionButton({ action, row, theme, onPress }: { action: Action; row: Row; theme: PluginTheme; onPress(): void }) {
  return <IconButton icon={ACTION_ICONS[action]} label={actionLabel(action, row)} theme={theme} onPress={onPress} />;
}

export interface RowViewProps {
  row: Row;
  theme: PluginTheme;
  compact: boolean;
  /** undefined when nothing folds under the row */
  expanded?: boolean;
  onPress(): void;
  onAction(action: Action): void;
  onMore(): void;
}

export function RowView({ row, theme, compact, expanded, onPress, onAction, onMore }: RowViewProps) {
  if (row.kind === 'notice') return <NoticeView row={row} theme={theme} onAction={onAction} />;
  const { colors } = theme;
  const header = row.kind === 'header';
  const errors = row.problems?.errors ?? 0;
  const warnings = row.problems?.warnings ?? 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: compact ? 8 : 4, paddingRight: 8, paddingLeft: 8 + row.depth * 14 }}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={row.tooltip ?? row.label} onPress={onPress}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}
      >
        {/* the chevron and icon keep their size: a long label shrinks, never them */}
        <View style={{ width: 12, flexShrink: 0 }}>
          {expanded === undefined ? null : <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={12} color={colors.foregroundMuted} />}
        </View>
        {row.icon ? (
          <View style={{ width: 14, height: 14, flexShrink: 0 }}>
            <Icon name={ROW_ICONS[row.icon]} size={14} color={row.icon === 'warning' ? colors.statusWarning : colors.foregroundMuted} />
          </View>
        ) : null}
        <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.foreground, fontWeight: header ? '600' : '400', fontSize: header ? 12 : 13 }}>
          {row.label}
        </Text>
        {row.detail ? <Text numberOfLines={1} style={{ flexShrink: 2, color: colors.foregroundMuted, fontSize: 12 }}>{row.detail}</Text> : null}
        {errors ? <Text style={{ flexShrink: 0, color: colors.statusDanger, fontSize: 12 }}>{`${errors} error${errors === 1 ? '' : 's'}`}</Text> : null}
        {warnings ? <Text style={{ flexShrink: 0, color: colors.statusWarning, fontSize: 12 }}>{`${warnings} warning${warnings === 1 ? '' : 's'}`}</Text> : null}
      </Pressable>
      {rowButtons(row, expanded !== undefined).map(action => <ActionButton key={action} action={action} row={row} theme={theme} onPress={() => onAction(action)} />)}
      {/* the sheet holds the actions with no button; a row whose every action has a button needs none */}
      {needsMore(row, expanded !== undefined) ? (
        <IconButton icon="Ellipsis" label="More actions" theme={theme} onPress={onMore} />
      ) : null}
    </View>
  );
}
