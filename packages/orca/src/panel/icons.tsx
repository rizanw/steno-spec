/** @jsxImportSource preact */
// The panel's icons: the Lucide set the Paseo panel uses, drawn as inline SVG in the text colour around them. Only the
// icons named here are bundled; an Orca panel cannot load a font or fetch anything, so they travel inside panel.js.
import {
  ArrowRight, Bot, Check, ChevronDown, ChevronRight, Circle, CircleCheck, CirclePlay, Ellipsis, Eye, FastForward,
  FilePen, FileText, Pencil, Play, Plus, RefreshCw, RotateCcw, Sparkles, TriangleAlert, Undo2, Wrench, type IconNode,
} from 'lucide';

const ICONS: Record<string, IconNode> = {
  ArrowRight, Bot, Check, ChevronDown, ChevronRight, Circle, CircleCheck, CirclePlay, Ellipsis, Eye, FastForward,
  FilePen, FileText, Pencil, Play, Plus, RefreshCw, RotateCcw, Sparkles, TriangleAlert, Undo2, Wrench,
};

/** A Lucide icon by name, sized in pixels; an unknown name draws nothing rather than a broken glyph. */
export function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const node = ICONS[name];
  if (!node) return null;
  return (
    <svg
      class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    >
      {node.map(([tag, attrs], i) => {
        const Tag = tag as 'path';
        return <Tag key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}
