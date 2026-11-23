/** @jsxImportSource preact */
// The steno panel: a page Orca shows in its right sidebar (an html panel), drawn like the Paseo panel and coloured
// only from Orca's theme. It holds the latest snapshot the worker posted, which rows are open, the open menu and the
// last answer worth saying; it reads no files and runs no steno itself. Every action is sent with the key of the row
// it was pressed on, so nothing needs selecting first.
import type { PanelAction } from '@steno/core/host';
import { render } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { ActResult, Snapshot } from '../shared/messages.js';
import { Icon } from './icons.js';
import { RowMenu, type MenuAt } from './menu.js';
import { RowView } from './row.js';
import { actionLabel, rowPress, START_EXPANDED, toggled, visibleRows } from './rows.js';
import './panel.css';

/** What the last action led to, when it is worth saying: steno refused it or there was nothing to do. */
function noticeOf(result: ActResult): string | undefined {
  if ('refusal' in result) return result.refusal.message;
  if ('nothing' in result) return result.nothing;
  return undefined;
}

function Panel() {
  const [snapshot, setSnapshot] = useState<Snapshot | undefined>(undefined);
  const [expanded, setExpanded] = useState<string[]>([...START_EXPANDED]);
  const [menu, setMenu] = useState<{ key: string; at: MenuAt } | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  useEffect(() => {
    const posts = orca.plugin.on('snapshot', post => setSnapshot(post.snapshot));
    // a menu or an answer left from the previous worktree would describe rows that are no longer shown
    let workspace: string | undefined;
    const focus = orca.on('workspace.changed', ({ context }) => {
      const id = context?.workspaceId;
      if (id !== workspace) { workspace = id; setMenu(undefined); setNotice(undefined); }
    });
    orca.plugin.request('steno.panel').then(setSnapshot, () => undefined);
    return () => { posts.dispose(); focus.dispose(); };
  }, []);

  const rows = useMemo(() => (snapshot ? [...snapshot.specRows, ...snapshot.steeringRows] : []), [snapshot]);
  const shown = useMemo(() => visibleRows(rows, expanded), [rows, expanded]);
  const menuRow = menu ? rows.find(row => row.key === menu.key) : undefined;

  const act = useCallback(async (key: string, action: PanelAction | 'restart') => {
    setMenu(undefined);
    const label = action === 'restart' ? 'Restart' : actionLabel(action, undefined);
    try { setNotice(noticeOf(await orca.plugin.request('steno.act', { key, action }))); } catch (err) { setNotice(`${label} failed: ${(err as Error).message}`); }
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
  return (
    <div class="panel">
      {snapshot.server === 'stopped' ? (
        <div class="bar danger" role="alert">
          <Icon name="TriangleAlert" />
          <span class="bar-text">steno stopped in this worktree after it kept crashing.</span>
          <button type="button" class="bar-button" onClick={() => act('', 'restart')}><Icon name="RefreshCw" size={13} />Restart</button>
        </div>
      ) : null}
      {notice ? (
        <div class="bar" role="status">
          <span class="bar-text">{notice}</span>
          <button type="button" class="bar-button" onClick={() => setNotice(undefined)}>Dismiss</button>
        </div>
      ) : null}
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
