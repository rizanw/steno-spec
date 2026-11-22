// Compile-time only, and imported by nothing: the typecheck covers it, and Paseo never bundles it. The shared
// contracts copy enums and shapes core owns, because the client bundle cannot reach core; each copy must stay the same
// set as core's, or typechecking fails here. This lives on the server side because a shared module may not import
// server code, not even its types.
import type { Diagnostic as CoreDiagnostic, PanelAction, PanelRow, ServerState as HostServerState, Handoff as CoreHandoff, HostAction, RowIcon as CoreRowIcon, StructuredError as CoreStructuredError, ChangeResult as CoreChangeResult } from './vendor/host.mjs';
import type { Action, ChangeResult, Diagnostic, Handoff, HOST_ACTIONS, Row, RowIcon, ServerState, StructuredError } from '../shared/contracts';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const agree: [
  Same<(typeof HOST_ACTIONS)[number], HostAction>, Same<RowIcon, CoreRowIcon>, Same<Diagnostic, CoreDiagnostic>,
  Same<StructuredError, CoreStructuredError>, Same<ChangeResult, CoreChangeResult>, Same<Handoff, CoreHandoff>,
  Same<Action, PanelAction>, Same<Row, PanelRow>, Same<ServerState, HostServerState>,
] = [true, true, true, true, true, true, true, true, true];
void agree;
