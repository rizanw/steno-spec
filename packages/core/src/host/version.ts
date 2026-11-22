// Version comparison a host's check of the agents' `steno` and its warning share; plain data, so a browser can use it.

/** Whether `version` is `lowest` or later, comparing major, minor and patch as numbers. */
export function atLeast(version: string, lowest: string): boolean {
  const [a, b] = [version, lowest].map(v => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}
