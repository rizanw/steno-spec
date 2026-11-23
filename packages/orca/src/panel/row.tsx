/** @jsxImportSource preact */
// One line of the panel, its icon buttons and the notice rows, drawn as the Paseo panel draws them
// (packages/paseo/client/row.tsx and notice.tsx). Every colour comes from panel.css, which reads Orca's theme.
import type { PanelAction, PanelRow } from '@steno/core/host';
import { Icon } from './icons.js';
import type { MenuAt } from './menu.js';
import { ACTION_ICONS, actionLabel, needsMore, problemCounts, ROW_ICONS, rowButtons, type VisibleRow } from './rows.js';

/** Pixels each level of nesting is indented by, as in the Paseo panel. */
const INDENT = 14;

export interface IconButtonProps { icon: string; label: string; onPress(event: MouseEvent): void; pressed?: boolean }

/**
 * A small icon button, as Orca and VS Code draw a list row's inline actions. Its name shows on hover to its left
 * (panel.css): these buttons end the row, so the name never runs off the panel's edge.
 */
export function IconButton({ icon, label, onPress, pressed }: IconButtonProps) {
  return (
    <button
      type="button" class={pressed ? 'icon-button pressed' : 'icon-button'} aria-label={label} data-label={label}
      onClick={event => { event.stopPropagation(); onPress(event); }}
    >
      <Icon name={icon} />
    </button>
  );
}

export interface RowViewProps {
  visible: VisibleRow;
  menuOpen: boolean;
  onPress(): void;
  onAction(action: PanelAction): void;
  /** Opens the row's menu under the `…` button, or at the pointer for a right-click. */
  onMenu(at: MenuAt): void;
}

export function RowView({ visible, menuOpen, onPress, onAction, onMenu }: RowViewProps) {
  const { row, expands, open, chevronSlot } = visible;
  if (row.kind === 'notice') return <NoticeView row={row} onAction={onAction} />;
  const { errors, warnings } = problemCounts(row);
  const more = needsMore(row, expands);
  return (
    <div
      class={['row', row.kind === 'header' ? 'header' : '', menuOpen ? 'menu-open' : ''].join(' ')}
      role="treeitem" tabIndex={0} aria-label={row.tooltip ?? row.label} title={row.tooltip}
      {...(expands ? { 'aria-expanded': open } : {})}
      style={{ paddingLeft: `${8 + row.depth * INDENT}px` }}
      onClick={onPress}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPress(); } }}
      // a row with no actions has no menu to show, so the browser's own stays out of the way too
      onContextMenu={event => { event.preventDefault(); if (row.actions.length) onMenu({ x: event.clientX, y: event.clientY, from: 'pointer' }); }}
    >
      {/* the chevron and icon keep their size: a long name shrinks, never them */}
      {chevronSlot ? <span class="chevron">{expands ? <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={12} /> : null}</span> : null}
      {row.icon ? <span class={row.icon === 'warning' ? 'status warning' : 'status'}><Icon name={ROW_ICONS[row.icon]} /></span> : null}
      <span class="name">{row.label}</span>
      {row.detail ? <span class="detail">{row.detail}</span> : null}
      {errors ? <span class="count error">{errors}</span> : null}
      {warnings ? <span class="count warning">{warnings}</span> : null}
      <span class="actions">
        {rowButtons(row, expands).map(action => (
          <IconButton key={action} icon={ACTION_ICONS[action]} label={actionLabel(action, row)} onPress={() => onAction(action)} />
        ))}
        {more ? (
          <IconButton
            icon="Ellipsis" label="More actions" pressed={menuOpen}
            onPress={event => {
              const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
              onMenu({ x: box.right, y: box.bottom + 2, from: 'button' });
            }}
          />
        ) : null}
      </span>
    </div>
  );
}

/** Set Up names what it sets up; the other actions read well as they are. */
const buttonLabel = (action: PanelAction, row: PanelRow): string => (action === 'setUp' ? 'Set Up steno' : actionLabel(action, row));

/** A notice may end in a word or a sentence; the detail reads as one, so it gets its full stop. */
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

/**
 * A notice row, such as "No specs yet", drawn like a welcome view: the words in full and centred over one wide
 * button. A notice at the top (the folder is not set up) stands alone and gets a heading and the primary button;
 * one inside a section stays lighter, so two empty sections do not stack two loud buttons.
 */
export function NoticeView({ row, onAction }: { row: PanelRow; onAction(action: PanelAction): void }) {
  const top = row.depth === 0;
  const action = row.primary;
  return (
    <div class={top ? 'notice top' : 'notice'} style={top ? undefined : { paddingLeft: `${8 + row.depth * INDENT + 20}px` }}>
      <div class="notice-label">{row.label}</div>
      {row.detail ? <div class="notice-detail">{sentence(row.detail)}</div> : null}
      {action ? (
        <button type="button" class={top ? 'wide-button primary' : 'wide-button'} onClick={() => onAction(action)}>
          <Icon name={ACTION_ICONS[action]} size={13} />
          <span>{buttonLabel(action, row)}</span>
        </button>
      ) : null}
    </div>
  );
}
