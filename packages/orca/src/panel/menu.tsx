/** @jsxImportSource preact */
// A row's menu: every action of the row with its icon and name, floating like Orca's own context menus. It opens
// from the row's `…` button (under it, right edges lined up) or from a right-click (at the pointer).
import type { PanelAction, PanelRow } from '@steno/core/host';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons.js';
import { ACTION_ICONS, actionLabel } from './rows.js';

/** Where the menu was asked for: the pointer for a right-click, the button's bottom-right corner for `…`. */
export interface MenuAt { x: number; y: number; from: 'pointer' | 'button' }

export interface RowMenuProps { row: PanelRow; at: MenuAt; onAction(action: PanelAction): void; onClose(): void }

/** Space kept between the menu and the panel's edges. */
const MARGIN = 4;

/**
 * Where the menu's top-left corner goes so all of it stays inside the panel: a menu opened from a button hangs to
 * its left, one at the pointer to its right, and either flips above when there is no room below.
 */
export function placeMenu(at: MenuAt, menu: { width: number; height: number }, view: { width: number; height: number }): { left: number; top: number } {
  const wanted = at.from === 'button' ? at.x - menu.width : at.x;
  const left = Math.max(MARGIN, Math.min(wanted, view.width - menu.width - MARGIN));
  const below = at.y + menu.height + MARGIN <= view.height;
  const top = below ? at.y : Math.max(MARGIN, at.y - menu.height - (at.from === 'button' ? 28 : 0));
  return { left, top };
}

export function RowMenu({ row, at, onAction, onClose }: RowMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | undefined>(undefined);

  // measured before the first paint, so the menu never shows at a spot it then jumps from
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    setPlace(placeMenu(at, { width: menu.offsetWidth, height: menu.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
    menu.querySelector<HTMLButtonElement>('button')?.focus();
  }, [at.x, at.y, at.from]);

  useEffect(() => {
    // the `…` that opened the menu toggles it itself; closing here too would reopen it on the same click
    const outside = (event: Event) => {
      const target = event.target as Element;
      if (!ref.current?.contains(target) && !target.closest?.('.icon-button.pressed')) onClose();
    };
    const away = () => onClose();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('blur', away);
    window.addEventListener('resize', away);
    document.addEventListener('scroll', away, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('blur', away);
      window.removeEventListener('resize', away);
      document.removeEventListener('scroll', away, true);
    };
  }, [onClose]);

  const move = (event: KeyboardEvent) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => { event.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (event.key === 'ArrowDown') go(at + 1);
    else if (event.key === 'ArrowUp') go(at - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(items.length - 1);
    else if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); onClose(); }
  };

  return (
    <div
      ref={ref} class="menu" role="menu" aria-label={`Actions for ${row.label}`} onKeyDown={move}
      // hidden until placed, so the first paint is already in the right spot
      style={place ? { left: `${place.left}px`, top: `${place.top}px` } : { left: '0px', top: '0px', visibility: 'hidden' }}
    >
      {row.actions.map(action => (
        <button key={action} type="button" role="menuitem" class="menu-item" onClick={() => { onClose(); onAction(action); }}>
          <Icon name={ACTION_ICONS[action]} />
          <span>{actionLabel(action, row)}</span>
        </button>
      ))}
    </div>
  );
}
