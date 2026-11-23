// Putting a skill call on the clipboard. Orca gives a plugin no way to: the host API has no clipboard call, and the
// panel's frame is refused the browser's clipboard permission. The worker runs on Node, so it hands the text to the
// platform's own copy program instead.
import { spawn } from 'node:child_process';

/** Copies `text`; resolves to whether it reached the clipboard, and never rejects. */
export type Copy = (text: string) => Promise<boolean>;

export interface CopyProgram { file: string; args: string[] }

/**
 * The programs that put their input on the clipboard here, in the order to try them. Linux has no single one: a
 * Wayland session takes wl-copy, X takes xclip or xsel, and whichever is installed wins.
 */
export function copyPrograms(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): CopyProgram[] {
  if (platform === 'darwin') return [{ file: 'pbcopy', args: [] }];
  if (platform === 'win32') return [{ file: 'clip', args: [] }];
  const x = [{ file: 'xclip', args: ['-selection', 'clipboard'] }, { file: 'xsel', args: ['--clipboard', '--input'] }];
  return env.WAYLAND_DISPLAY ? [{ file: 'wl-copy', args: [] }, ...x] : x;
}

/** How long one copy program gets before the next is tried; pbcopy and clip take a few milliseconds. */
const COPY_TIMEOUT_MS = 2000;

function tryProgram({ file, args }: CopyProgram, text: string): Promise<boolean> {
  return new Promise(resolve => {
    // xclip and wl-copy stay behind to serve the selection, holding no pipe of ours, so their first process exiting
    // is the answer, not the streams closing
    const child = spawn(file, args, { shell: false, windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
    const timer = setTimeout(() => { child.unref(); resolve(false); }, COPY_TIMEOUT_MS);
    const done = (ok: boolean) => { clearTimeout(timer); resolve(ok); };
    child.on('error', () => done(false));
    child.on('exit', code => done(code === 0));
    child.stdin.on('error', () => {});
    child.stdin.end(text);
  });
}

/** Copy `text` with the first program here that takes it. */
export async function copyText(text: string, programs: readonly CopyProgram[] = copyPrograms()): Promise<boolean> {
  for (const program of programs) if (await tryProgram(program, text)) return true;
  return false;
}

/** How to paste on this platform, for a notice that says the call is on the clipboard. */
export const PASTE_KEY = process.platform === 'darwin' ? '⌘V' : 'Ctrl+V';
