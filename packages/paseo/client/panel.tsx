// The steno tab in a workspace's Explorer. The server sends every row ready to draw; this file only keeps what is
// local to the tab (which rows are expanded, which file is open) and turns a row's action into a call.
import type { PluginWorkspacePanelProps } from '@getpaseo/plugin/client';
import { useRpc, useSubscription, useTabState } from '@getpaseo/plugin/client';
import { FlatList, Loading, useToast } from '@getpaseo/plugin/client/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { z } from 'zod';
import { change, panel, restart, type Action, type PanelSnapshot, type Row, type StructuredError } from '../shared/contracts';
import { rowsOffering } from './commands';
import { changeFor, performChange, successMessage, type ChangeRequest } from './changes';
import { ReopenConfirm, Refusal } from './confirm';
import { useHandoff } from './agents';
import { DocumentView } from './document';
import { handoffFor } from './handoff';
import { actionLabel, allRows, DEFAULT_EXPANDED, opensDocument, parents, toggled, visibleRows } from './model';
import { NewSpecForm } from './new-spec';
import { RowView } from './row';
import { SetUpForm } from './set-up';
import { ActionSheet, RowPicker, StatusBars, type RowPick } from './sheet';

/** Kept by Paseo with the tab, so a reload or a reconnect reopens the same rows and the same file. */
const TabState = z.object({ expanded: z.array(z.string()), open: z.string().nullable() });
const DEFAULT_TAB = { expanded: DEFAULT_EXPANDED, open: null };

export function StenoPanel({ workspaceId, tab, theme, layout, navigation }: PluginWorkspacePanelProps) {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<PanelSnapshot>();
  const [revision, setRevision] = useState(0);
  // an intent rides in one snapshot only, so it is kept apart from the snapshot until the panel has acted on it
  const [pendingIntent, setPendingIntent] = useState<Action>();
  const state = useSubscription(panel, { workspaceId }, event => {
    setSnapshot(event); setRevision(r => r + 1);
    if (event.intent) setPendingIntent(event.intent);
  });
  const [tabState, setTabState] = useTabState(tab, TabState, DEFAULT_TAB);
  const [sheetRow, setSheetRow] = useState<Row>();
  const [refused, setRefused] = useState<StructuredError>();
  const [confirming, setConfirming] = useState<ChangeRequest>();
  const answer = useRef<(reopen: boolean) => void>(undefined);
  const [form, setForm] = useState<'newSpec' | 'setUp'>();
  const [pick, setPick] = useState<RowPick>();
  const { handOff, probes } = useHandoff(workspaceId, navigation);

  /** An error nobody planned for, such as a lost connection: said plainly, with Paseo's own words after it. */
  const showFailure = useCallback((err: unknown) => toast.error(`That didn't work: ${err instanceof Error ? err.message : String(err)}`), [toast]);
  const sendChange = useRpc(change);
  const sendRestart = useRpc(restart);

  const rows = useMemo(() => (snapshot ? allRows(snapshot) : []), [snapshot]);
  const withChildren = useMemo(() => parents(rows), [rows]);
  const shown = useMemo(() => visibleRows(rows, tabState.expanded), [rows, tabState.expanded]);

  const onRestart = useCallback(() => { sendRestart({ workspaceId }).catch(err => showFailure(err)); }, [sendRestart, workspaceId, showFailure]);

  const confirm = useCallback((request: ChangeRequest) => new Promise<boolean>(resolve => {
    answer.current = resolve;
    setConfirming(request);
  }), []);

  const onAction = useCallback((row: Row, action: Action) => {
    if (action === 'open') {
      if (row.path) setTabState({ ...tabState, open: row.path });
      return;
    }
    if (action === 'newSpec' || action === 'setUp') { setForm(action); return; }
    const handoff = handoffFor(row, action);
    if (handoff) { handOff(handoff).catch(err => showFailure(err)); return; }
    const request = changeFor(row, action);
    if (!request) {
      toast.show(`${actionLabel(action, row)} isn't available on this row.`, { variant: 'info' });
      return;
    }
    performChange(request, confirm, r => sendChange({ workspaceId, ...r })).then(outcome => {
      if (!outcome) return;
      if (outcome.ok) toast.show(successMessage(request, outcome.result), { variant: 'success' });
      else setRefused(outcome.error);
    }, err => showFailure(err));
  }, [tabState, setTabState, toast, confirm, sendChange, workspaceId, handOff, showFailure]);

  // a Command Center item: a form or steering at once, else a picker of the rows that offer the action
  useEffect(() => {
    if (!pendingIntent || !snapshot) return;
    setPendingIntent(undefined);
    if (pendingIntent === 'newSpec' || pendingIntent === 'setUp') { setForm(pendingIntent); return; }
    if (pendingIntent === 'steer') { handOff({ kind: 'steer' }).catch(err => showFailure(err)); return; }
    const offering = rowsOffering(rows, pendingIntent);
    if (offering.length) setPick({ action: pendingIntent, rows: offering });
    else toast.show(`No row offers ${actionLabel(pendingIntent, undefined)} right now.`, { variant: 'info' });
  }, [pendingIntent, snapshot, rows, handOff, showFailure, toast]);

  const onPress = useCallback((row: Row) => {
    if (withChildren.has(row.key)) setTabState({ ...tabState, expanded: toggled(tabState.expanded, row.key) });
    else if (opensDocument(row)) setTabState({ ...tabState, open: row.path! });
  }, [withChildren, tabState, setTabState]);

  if (!snapshot) return <Loading />;

  const openPath = tabState.open;
  const dialogs = (
    <>
      <RowPicker pick={pick} theme={theme} onClose={() => setPick(undefined)} onAction={onAction} />
      <ActionSheet row={sheetRow} theme={theme} onClose={() => setSheetRow(undefined)} onAction={onAction} />
      <ReopenConfirm request={confirming} theme={theme} onAnswer={reopen => { setConfirming(undefined); answer.current?.(reopen); answer.current = undefined; }} />
      <Refusal error={refused} stopped={snapshot.server === 'stopped'} theme={theme} onClose={() => setRefused(undefined)} onRestart={onRestart} />
      <NewSpecForm
        open={form === 'newSpec'} workspaceId={workspaceId} theme={theme} onClose={() => setForm(undefined)}
        onCreated={(spec, handoff) => {
          setForm(undefined);
          toast.show(`${spec} is created.`, { variant: 'success' });
          if (handoff) handOff(handoff).catch(err => showFailure(err));
        }}
      />
      <SetUpForm
        open={form === 'setUp'} workspaceId={workspaceId} theme={theme} onClose={() => setForm(undefined)}
        onDone={agents => { setForm(undefined); toast.show(agents.length ? `steno is set up for ${agents.join(', ')}.` : 'steno is set up. The skills are in the shared skills folder.', { variant: 'success' }); }}
      />
      {probes}
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <StatusBars snapshot={snapshot} state={state} theme={theme} onRestart={onRestart} />
      {openPath !== null ? (
        <DocumentView
          workspaceId={workspaceId} path={openPath} row={rows.find(r => r.path === openPath)} diagnostics={snapshot.diagnostics[openPath] ?? []}
          revision={revision} theme={theme} compact={layout.compact} onBack={() => setTabState({ ...tabState, open: null })} onAction={onAction}
        />
      ) : (
        <FlatList
          data={shown} keyExtractor={row => row.key}
          renderItem={({ item }) => (
            <RowView
              row={item} theme={theme} compact={layout.compact}
              expanded={withChildren.has(item.key) ? tabState.expanded.includes(item.key) : undefined}
              onPress={() => onPress(item)} onAction={action => onAction(item, action)} onMore={() => setSheetRow(item)}
            />
          )}
        />
      )}
      {dialogs}
    </View>
  );
}
