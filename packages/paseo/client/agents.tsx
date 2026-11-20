// The live side of a hand-off: the workspace's agents, each one's composer, and the focused composer, kept in refs
// so a hand-off in progress sees them change while it waits for an opened agent.
//
// A composer does not say which agent it belongs to. Paseo hands out one composer object per agent state, the same
// object for `{ focused: true }` and for `{ agentId }`, so the focused agent is the one whose own composer is the
// focused composer. That is how a focused agent of another workspace is told apart: it has no probe here.
import type { AgentRef, PluginComposer, PluginWorkspacePanelProps } from '@getpaseo/plugin/client';
import { useAgent, useAgents, useComposers, useRpc } from '@getpaseo/plugin/client';
import { copyText, useToast } from '@getpaseo/plugin/client/ui';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { call, type Handoff } from '../shared/contracts';
import { openDrafts } from './drafts';
import { chooseTarget, performHandoff, type AgentInfo, type HandoffResult } from './handoff';

/** The paste shortcut of this client: Paseo's desktop app runs as web, so the Mac is told apart by its user agent. */
function pasteHint(): string {
  if (Platform.OS !== 'web') return 'paste it';
  const mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
  return mac ? 'press ⌘V' : 'press Ctrl+V';
}

interface Probed { info: AgentInfo; composer: PluginComposer | undefined }

/** Renders nothing; reports one agent's snapshot and composer on every change. */
function AgentProbe({ agent, into }: { agent: AgentRef; into: Map<string, Probed> }) {
  const snapshot = useAgent(agent);
  const [composer] = useComposers({ agentId: agent.id });
  if (snapshot) into.set(agent.id, { info: { id: snapshot.id, provider: snapshot.provider, lastActivityAt: snapshot.lastActivityAt }, composer });
  useEffect(() => () => { into.delete(agent.id); }, [into, agent.id]);
  return null;
}

export interface HandoffApi {
  handOff(handoff: Handoff): Promise<HandoffResult>;
  /** Mount these once in the panel; they keep the agents and composers current. */
  probes: ReactNode;
}

export function useHandoff(workspaceId: string, navigation: PluginWorkspacePanelProps['navigation']): HandoffApi {
  const toast = useToast();
  const sendCall = useRpc(call);
  const query = useMemo(() => ({ where: (a: { workspaceId: string; background: boolean; status: string }) => a.workspaceId === workspaceId && !a.background && a.status !== 'closed' }), [workspaceId]);
  const agents = useAgents(query);
  const [focused] = useComposers({ focused: true });
  const probed = useRef(new Map<string, Probed>()).current;
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const navRef = useRef(navigation);
  navRef.current = navigation;

  const focusedAgentId = useCallback((): string | null => {
    const now = focusedRef.current;
    if (!now) return null;
    for (const [id, p] of probed) if (p.composer === now) return id;
    return null;
  }, [probed]);

  const handOff = useCallback(async (handoff: Handoff) => {
    const nav = navRef.current;
    const target = chooseTarget(focusedAgentId(), [...probed.values()].map(p => p.info), nav !== undefined, openDrafts().map(d => d.agent.provider));
    return performHandoff(target, {
      call: provider => sendCall({ workspaceId, handoff, ...(provider ? { provider } : {}) }),
      focusedComposer: agentId => (focusedAgentId() === agentId ? focusedRef.current : undefined),
      openAgent: agentId => navRef.current?.openAgent({ agentId }),
      draftComposer: () => { const drafts = openDrafts(); return drafts.length === 1 ? drafts[0] : undefined; },
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
      copy: copyText,
      paste: pasteHint(),
      notify: (message, variant) => (variant === 'error' ? toast.error(message) : toast.show(message, { variant })),
    });
  }, [focusedAgentId, probed, sendCall, workspaceId, toast]);

  const probes = agents.map(agent => <AgentProbe key={agent.id} agent={agent} into={probed} />);
  return { handOff, probes };
}
