// A stand-in for `vscode-languageclient/node`, so unit tests can import the extension's modules without
// loading the real library (which expects a live extension host). The pool's production factory is the only
// code that touches it, and every test passes its own `createClient` fake instead.
export enum TransportKind { stdio = 0, ipc = 1, pipe = 2, socket = 3 }
export enum ErrorAction { Continue = 1, Shutdown = 2 }
export enum CloseAction { DoNotRestart = 1, Restart = 2 }

export interface ErrorHandler {
  error(error: Error, message: unknown, count: number | undefined): { action: ErrorAction };
  closed(): { action: CloseAction };
}

export class LanguageClient {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly serverOptions: unknown,
    readonly clientOptions: unknown,
  ) {}
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async sendRequest<T>(): Promise<T> { throw new Error('the stubbed LanguageClient answers no request'); }
  onNotification(): { dispose(): void } { return { dispose: () => {} }; }
}

export type LanguageClientOptions = Record<string, unknown>;
export type ServerOptions = Record<string, unknown>;
