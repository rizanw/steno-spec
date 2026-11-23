/** @jsxImportSource preact */
// The steno panel: a page Orca shows in its right sidebar (an html panel), drawn like the Paseo panel and coloured
// only from Orca's theme. It holds the latest snapshot the worker posted, which rows are open, the open menu and the
// last answer worth saying; it reads no files and runs no steno itself. Every action is sent with the key of the row
// it was pressed on, so nothing needs selecting first.
import type { StructuredError } from '@steno/core';
import type { PanelAction } from '@steno/core/host';
import type { ReopenTarget } from '@steno/core/host/ui';
import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ActResult, Form, RunningAgent, Snapshot } from '../shared/messages.js';
import { noAnswer, unknownOutcome } from './errors.js';
import { AgentPick, DefaultAgentPick, DismissButton, NewSpecForm, RefusalBar, ReopenConfirm, SetUpPick } from './forms.js';
import { Icon, StenoMark } from './icons.js';
import { RowMenu, type MenuAt } from './menu.js';
import { RowView } from './row.js';
import { actionLabel, agentLine, agentStenoWarning, reopenTarget, rowPress, START_EXPANDED, toggled, visibleRows } from './rows.js';
import './panel.css';

/** What the last action led to, when it is worth a line: there was nothing to do. A refusal gets its own bar. */
function noticeOf(result: ActResult): string | undefined {
  return 'nothing' in result ? result.nothing : undefined;
}

function Panel() {
  const [snapshot, setSnapshot] = useState<Snapshot | undefined>(undefined);
  const [expanded, setExpanded] = useState<string[]>([...START_EXPANDED]);
  const [menu, setMenu] = useState<{ key: string; at: MenuAt } | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [refusal, setRefusal] = useState<StructuredError | undefined>(undefined);
  const [confirm, setConfirm] = useState<{ key: string; target: ReopenTarget } | undefined>(undefined);
  // a form the worker asked for: which one, the row and action it answers, and the agents it offers
  const [asked, setAsked] = useState<{ form: Exclude<Form, 'reopenConfirm'>; key: string; action: string; choices: string[]; running: RunningAgent[] } | undefined>(undefined);
  // an action that got no answer: its name, and whether the rows have been redrawn from steno since
  const [unknown, setUnknown] = useState<{ label: string; fresh: boolean } | undefined>(undefined);

  useEffect(() => {
    const posts = orca.plugin.on('snapshot', post => setSnapshot(post.snapshot));
    // a menu or an answer left from the previous worktree would describe rows that are no longer shown
    let workspace: string | undefined;
    const focus = orca.on('workspace.changed', ({ context }) => {
      const id = context?.workspaceId;
      if (id !== workspace) { workspace = id; setMenu(undefined); setNotice(undefined); setRefusal(undefined); setConfirm(undefined); setAsked(undefined); setUnknown(undefined); }
    });
    // a panel opened after steno refused a change still shows why
    orca.plugin.request('steno.panel').then(snap => { setSnapshot(snap); setRefusal(snap.refusal); }, () => undefined);
    return () => { posts.dispose(); focus.dispose(); };
  }, []);

  const rows = useMemo(() => (snapshot ? [...snapshot.specRows, ...snapshot.steeringRows] : []), [snapshot]);
  const shown = useMemo(() => visibleRows(rows, expanded), [rows, expanded]);
  const menuRow = menu ? rows.find(row => row.key === menu.key) : undefined;

  // rows read through a ref, so `act` stays one function while snapshots come and go
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const show = useCallback((key: string, result: ActResult, action = '') => {
    setNotice(noticeOf(result));
    setRefusal('refusal' in result ? result.refusal : undefined);
    const target = 'form' in result && result.form === 'reopenConfirm' ? reopenTarget(rowsRef.current.find(r => r.key === key)) : undefined;
    setConfirm(target ? { key, target } : undefined);
    const form = 'form' in result && result.form !== 'reopenConfirm' ? result : undefined;
    setAsked(form ? { form: form.form as Exclude<Form, 'reopenConfirm'>, key: form.key ?? key, action, choices: form.choices ?? [], running: form.running ?? [] } : undefined);
  }, []);
  // The last snapshot stays drawn while this asks for the tree as it is now; a failed ask leaves the bar's Retry.
  const refetch = useCallback(async (label: string) => {
    try {
      setSnapshot(await orca.plugin.request('steno.panel'));
      setUnknown({ label, fresh: true });
    } catch { setUnknown({ label, fresh: false }); }
  }, []);
  const failed = useCallback((label: string, err: unknown) => {
    if (!noAnswer(err)) { setNotice(`${label} failed: ${(err as Error).message}`); return; }
    setNotice(undefined);
    setUnknown({ label, fresh: false });
    void refetch(label);
  }, [refetch]);
  const act = useCallback(async (key: string, action: PanelAction | 'restart' | 'chooseAgent') => {
    setMenu(undefined);
    setUnknown(undefined);
    const label = action === 'restart' ? 'Restart' : action === 'chooseAgent' ? 'Change agent' : actionLabel(action, undefined);
    try { show(key, await orca.plugin.request('steno.act', { key, action }), action); } catch (err) { failed(label, err); }
  }, [show, failed]);
  // Cancel sends nothing, so the worker never runs the CLI or starts an agent for a form left unanswered
  const submit = useCallback(async (answers: Record<string, string> | undefined) => {
    const form = asked;
    setAsked(undefined);
    if (!answers || !form) return;
    setUnknown(undefined);
    const label = form.form === 'newSpec' ? 'New Spec' : form.form === 'setUp' ? 'Set Up' : form.form === 'defaultAgent' ? 'Change agent' : actionLabel(form.action as PanelAction, undefined);
    const sent = form.form === 'agentPick' ? { ...answers, action: form.action } : answers;
    try { show(form.key, await orca.plugin.request('steno.submit', { form: form.form, key: form.key, answers: sent })); }
    catch (err) { failed(label, err); }
  }, [asked, show, failed]);
  const cancel = useCallback(() => void submit(undefined), [submit]);
  // nothing is sent on Cancel: the reopen waits on the worker's side for this Confirm alone
  const answerReopen = useCallback(async (reopen: boolean) => {
    const asked = confirm;
    setConfirm(undefined);
    if (!reopen || !asked) return;
    setUnknown(undefined);
    try { show(asked.key, await orca.plugin.request('steno.submit', { form: 'reopenConfirm', key: asked.key, answers: {} })); }
    catch (err) { failed('Reopen', err); }
  }, [confirm, show, failed]);
  // the button stays disabled while the check runs, since `steno --version` may take a few seconds to answer
  const [checking, setChecking] = useState(false);
  const recheck = useCallback(async () => {
    setChecking(true);
    try { setSnapshot(await orca.plugin.request('steno.recheck')); } catch (err) { setNotice(`Re-check failed: ${(err as Error).message}`); }
    finally { setChecking(false); }
  }, []);
  const closeMenu = useCallback(() => setMenu(undefined), []);
  // a snapshot that no longer has the menu's row closes the menu, so it never offers actions on a row that is gone
  useEffect(() => { if (menu && !menuRow) setMenu(undefined); }, [menu, menuRow]);

  // the arrow keys move between rows as in Orca's own lists; Enter on a row presses it (row.tsx)
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const all = Array.from(document.querySelectorAll<HTMLElement>('.rows > .row'));
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (at === -1) return;
    event.preventDefault();
    all[Math.max(0, Math.min(all.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  if (!snapshot) return <div class="loading">Loading steno…</div>;
  const warning = agentStenoWarning(snapshot.agentSteno);
  return (
    <div class="panel">
      {/* the bars, forms and agent line stay pinned while the rows scroll, so an answer is never left off screen */}
      <div class="pinned">
      {snapshot.server === 'stopped' ? (
        <div class="bar danger" role="alert">
          <Icon name="TriangleAlert" />
          <span class="bar-text">steno stopped in this worktree after it kept crashing.</span>
          <div class="bar-actions"><button type="button" class="bar-button" onClick={() => act('', 'restart')}><Icon name="RefreshCw" size={13} />Restart</button></div>
        </div>
      ) : null}
      {warning ? (
        <div class="bar warning" role="status">
          <Icon name="TriangleAlert" />
          <span class="bar-text">{warning}</span>
          <div class="bar-actions"><button type="button" class="bar-button" disabled={checking} onClick={() => void recheck()}><Icon name="RefreshCw" size={13} />Re-check</button></div>
        </div>
      ) : null}
      {unknown ? (
        <div class="bar danger" role="alert">
          <Icon name="TriangleAlert" />
          <span class="bar-text">{unknownOutcome(unknown.label, unknown.fresh)}</span>
          <DismissButton onDismiss={() => setUnknown(undefined)} />
          {unknown.fresh ? null : <div class="bar-actions"><button type="button" class="bar-button" onClick={() => void refetch(unknown.label)}><Icon name="RefreshCw" size={13} />Retry</button></div>}
        </div>
      ) : null}
      {asked?.form === 'newSpec' ? <NewSpecForm agents={asked.choices} onSubmit={answers => void submit(answers)} onCancel={cancel} /> : null}
      {asked?.form === 'setUp' ? <SetUpPick agents={asked.choices} onSubmit={answers => void submit(answers)} onCancel={cancel} /> : null}
      {asked?.form === 'defaultAgent' ? (
        <DefaultAgentPick agents={asked.choices} current={snapshot.defaultAgent} onSubmit={answers => void submit(answers)} onCancel={cancel} />
      ) : null}
      {asked?.form === 'agentPick' ? (
        <AgentPick title={actionLabel(asked.action as PanelAction, rows.find(r => r.key === asked.key))} agents={asked.choices} running={asked.running}
          onSubmit={answers => void submit(answers)} onCancel={cancel} />
      ) : null}
      {confirm ? <ReopenConfirm target={confirm.target} onAnswer={reopen => void answerReopen(reopen)} /> : null}
      {refusal ? <RefusalBar error={refusal} onDismiss={() => setRefusal(undefined)} /> : null}
      {notice ? (
        <div class="bar" role="status">
          <span class="bar-text">{notice}</span>
          <DismissButton onDismiss={() => setNotice(undefined)} />
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div class="agent-line">
          <StenoMark />
          <span class="agent-line-text">{agentLine(snapshot.defaultAgent)}</span>
          <button type="button" class="link-button" onClick={() => void act('', 'chooseAgent')}>Change</button>
        </div>
      ) : null}
      </div>
      <div class="rows" role="tree" aria-label="steno specs and steering" onKeyDown={onKeyDown}>
        {shown.map(visible => (
          <RowView
            key={visible.row.key} visible={visible} menuOpen={menu?.key === visible.row.key}
            onPress={() => {
              const press = rowPress(visible);
              if (press === 'toggle') setExpanded(keys => toggled(keys, visible.row.key));
              else if (press === 'open') void act(visible.row.key, 'open');
            }}
            onAction={action => void act(visible.row.key, action)}
            onMenu={at => setMenu(current => (current?.key === visible.row.key && at.from === 'button' ? undefined : { key: visible.row.key, at }))}
          />
        ))}
      </div>
      {menu && menuRow ? <RowMenu row={menuRow} at={menu.at} onAction={action => void act(menuRow.key, action)} onClose={closeMenu} /> : null}
    </div>
  );
}

render(<Panel />, document.getElementById('root')!);
