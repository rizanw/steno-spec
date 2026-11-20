import type { PluginClientContext } from '@getpaseo/plugin/client';
import { LOGO_SVG } from './client/vendor/logo';
import { registerCommands } from './client/commands';
import { DraftProbe } from './client/drafts';
import { StenoPanel } from './client/panel';

export default function contribute(client: PluginClientContext) {
  const removePanel = client.addWorkspacePanel({ id: 'steno', title: 'steno', icon: { svg: LOGO_SVG }, locations: ['explorer'], Component: StenoPanel });
  // renders nothing; lets a hand-off find an open New Agent screen, which Paseo does not list for plugins
  const removeDraftProbe = client.addComposerItem({ id: 'steno-draft', Component: DraftProbe });
  const removeCommands = registerCommands(client);
  return () => { removePanel(); removeDraftProbe(); removeCommands(); };
}
