// Where a row's menu opens: always wholly inside the panel, whether it came from a button or a right-click.
import { describe, expect, it } from 'vitest';
import { placeMenu } from '../src/panel/menu.js';

const view = { width: 360, height: 600 };
const menu = { width: 180, height: 80 };

describe('the row menu\'s place', () => {
  it('hangs under a button with their right edges lined up', () => {
    expect(placeMenu({ x: 350, y: 100, from: 'button' }, menu, view)).toEqual({ left: 170, top: 100 });
  });

  it('opens to the right of the pointer for a right-click', () => {
    expect(placeMenu({ x: 40, y: 100, from: 'pointer' }, menu, view)).toEqual({ left: 40, top: 100 });
  });

  it('moves left rather than run past the panel\'s right edge', () => {
    expect(placeMenu({ x: 300, y: 100, from: 'pointer' }, menu, view).left).toBe(360 - 180 - 4);
  });

  it('flips above when there is no room below', () => {
    expect(placeMenu({ x: 40, y: 560, from: 'pointer' }, menu, view).top).toBe(480);
    expect(placeMenu({ x: 350, y: 560, from: 'button' }, menu, view).top).toBe(560 - 80 - 28);
  });

  it('never starts above or left of the panel', () => {
    expect(placeMenu({ x: 10, y: 30, from: 'button' }, menu, { width: 120, height: 90 })).toEqual({ left: 4, top: 4 });
  });
});
