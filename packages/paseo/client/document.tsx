// One file the panel lists, read-only: the row's actions, the file's lint problems, then its text as formatted
// Markdown. Each snapshot that still lists the file reads it again, so an edit on disk shows without a tap.
import type { PluginTheme } from '@getpaseo/plugin';
import { useRpc } from '@getpaseo/plugin/client';
import { Icon, Markdown, ScrollView } from '@getpaseo/plugin/client/ui';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { readFile, type Action, type Diagnostic, type Row } from '../shared/contracts';
import { ActionButton } from './row';

export interface DocumentViewProps {
  workspaceId: string;
  /** the row as the latest snapshot has it; undefined once no row lists the file */
  row: Row | undefined;
  path: string;
  diagnostics: readonly Diagnostic[];
  /** counts snapshots, so each one triggers a fresh read */
  revision: number;
  theme: PluginTheme;
  compact: boolean;
  onBack(): void;
  onAction(row: Row, action: Action): void;
}

type Content = { text: string } | { error: string } | undefined;

export function DocumentView({ workspaceId, row, path, diagnostics, revision, theme, compact, onBack, onAction }: DocumentViewProps) {
  const read = useRpc(readFile);
  const [content, setContent] = useState<Content>();
  const listed = row !== undefined;
  useEffect(() => {
    if (!listed) return;
    let current = true;
    read({ workspaceId, path }).then(
      r => { if (current) setContent({ text: r.text }); },
      () => { if (current) setContent({ error: 'not a steno file' }); },
    );
    return () => { current = false; };
  }, [read, workspaceId, path, revision, listed]);

  const { colors } = theme;
  const pad = compact ? 12 : 16;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 8, borderBottomWidth: 1, borderColor: colors.border }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to the list" onPress={onBack} style={{ padding: 4 }}>
          <Icon name="ArrowLeft" size={16} color={colors.foreground} />
        </Pressable>
        <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.foreground, fontWeight: '600' }}>{row?.label ?? path}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginLeft: 'auto' }}>
          {(row?.actions ?? []).filter(a => a !== 'open').map(action => (
            <ActionButton key={action} action={action} row={row!} theme={theme} onPress={() => onAction(row!, action)} />
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: pad, gap: 12 }}>
        {!listed ? <Text style={{ color: colors.statusWarning }}>The panel no longer lists this file.</Text> : null}
        {diagnostics.length ? (
          <View style={{ gap: 4 }}>
            {diagnostics.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>{`line ${d.line}`}</Text>
                <Text style={{ color: d.severity === 'error' ? colors.statusDanger : colors.statusWarning, fontSize: 12 }}>{d.severity}</Text>
                <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 12 }}>{d.message}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {content === undefined ? null
          : 'error' in content ? <Text style={{ color: colors.statusDanger }}>{content.error}</Text>
          : <Markdown>{content.text}</Markdown>}
      </ScrollView>
    </View>
  );
}
