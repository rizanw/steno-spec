/** @jsxImportSource preact */
// The prompts and bars around a change: New Spec, Set Up's and a hand-off's agent pick, the confirmation a reopen
// waits for, worded as the other hosts word it, and a refusal with every lint problem that blocked it. Nothing here
// sends anything; the page does once the user submits, so Cancel or Escape leaves everything as it was.
import type { StructuredError } from '@steno/core';
import { reopenWording, type ReopenTarget } from '@steno/core/host/ui';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from './icons.js';
import type { RunningAgent } from '../shared/messages.js';
import { newSpecAnswers, newSpecStart, pickEntries, refusalProblems, sendsForm, setUpAnswers, type NewSpecFields } from './rows.js';

type Answers = Record<string, string>;

interface FormShellProps { title: string; body?: string; submit: string; answers: Answers | undefined; onSubmit(answers: Answers): void; onCancel(): void; children: ComponentChildren }

/**
 * A form bar: its fields, then Cancel and the submit button, which stays off until the answers can be sent.
 *
 * Orca draws the panel in an iframe sandboxed with `allow-scripts` alone, and without `allow-forms` the browser
 * drops a form's submission before any `submit` event fires. So this is no `<form>`: the button's click and Enter
 * in a field send the answers themselves, and a `submit` listener here would never hear a thing.
 */
function FormShell({ title, body, submit, answers, onSubmit, onCancel, children }: FormShellProps) {
  const send = () => { if (answers) onSubmit(answers); };
  return (
    <div class="bar form" role="form" aria-label={title}
      onKeyDown={event => {
        if (event.key === 'Escape') onCancel();
        else if (sendsForm(event.key, event.target as HTMLInputElement)) { event.preventDefault(); send(); }
      }}>
      <div class="bar-text">
        <div class="form-title">{title}</div>
        {body ? <div class="form-body">{body}</div> : null}
        <div class="fields">{children}</div>
        <div class="form-buttons end">
          <button type="button" class="bar-button" onClick={onCancel}>Cancel</button>
          <button type="button" class="bar-button primary" disabled={!answers} onClick={send}>{submit}</button>
        </div>
      </div>
    </div>
  );
}

export interface NewSpecFormProps { agents: string[]; onSubmit(answers: Answers): void; onCancel(): void }

/** The kind, name, optional title, who writes the first document (and which agent) and an optional description. */
export function NewSpecForm({ agents, onSubmit, onCancel }: NewSpecFormProps) {
  const [fields, setFields] = useState<NewSpecFields>(() => newSpecStart(agents));
  const set = <K extends keyof NewSpecFields>(key: K, value: NewSpecFields[K]) => setFields(current => ({ ...current, [key]: value }));
  const text = (key: 'name' | 'title' | 'description', label: string, placeholder: string, autoFocus = false) => (
    <label class="field">
      <span>{label}</span>
      <input type="text" value={fields[key]} placeholder={placeholder} autoFocus={autoFocus}
        onInput={event => set(key, (event.target as HTMLInputElement).value)} />
    </label>
  );
  return (
    <FormShell title="New Spec" submit="Create" answers={newSpecAnswers(fields)} onSubmit={onSubmit} onCancel={onCancel}>
      <label class="field">
        <span>Kind</span>
        <select value={fields.kind} onChange={event => set('kind', (event.target as HTMLSelectElement).value as NewSpecFields['kind'])}>
          <option value="feature">Feature</option>
          <option value="bugfix">Bugfix</option>
        </select>
      </label>
      {text('name', 'Name', 'link-expiry, as a kebab-case slug', true)}
      {text('title', 'Title (optional)', fields.name.trim() || 'The one line the panel shows')}
      <fieldset class="field">
        <legend>Who writes the first document?</legend>
        <label class="choice"><input type="radio" name="writer" checked={fields.writer === 'self'} onChange={() => set('writer', 'self')} />I do</label>
        <label class="choice">
          <input type="radio" name="writer" checked={fields.writer === 'agent'} disabled={!agents.length} onChange={() => set('writer', 'agent')} />A coding agent
        </label>
      </fieldset>
      {fields.writer === 'agent' ? (
        <label class="field">
          <span>Agent</span>
          <select value={fields.agent} onChange={event => set('agent', (event.target as HTMLSelectElement).value)}>
            {agents.map(agent => <option key={agent} value={agent}>{agent}</option>)}
          </select>
        </label>
      ) : null}
      {text('description', 'Description (optional)', fields.kind === 'bugfix' ? 'Login times out on slow networks' : 'Let users export invoices as CSV')}
    </FormShell>
  );
}

export interface AgentPickProps { title: string; agents: string[]; running: RunningAgent[]; onSubmit(answers: Answers): void; onCancel(): void }

/**
 * The agent a hand-off goes to: one already running in a terminal, listed first, or a new one. Nothing is remembered
 * between picks, so it always starts on the first line.
 */
export function AgentPick({ title, agents, running, onSubmit, onCancel }: AgentPickProps) {
  const entries = pickEntries(running, agents);
  const [value, setValue] = useState(entries[0]?.value ?? '');
  const picked = entries.find(e => e.value === value);
  return (
    <FormShell title={title} body="Which coding agent should take this?" submit="Start" answers={picked?.answers} onSubmit={onSubmit} onCancel={onCancel}>
      <select aria-label="Agent" value={value} autoFocus onChange={event => setValue((event.target as HTMLSelectElement).value)}>
        {entries.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
      </select>
    </FormShell>
  );
}

export interface DefaultAgentPickProps { agents: string[]; current: string | undefined; onSubmit(answers: Answers): void; onCancel(): void }

/** The agent this worktree hands work to from now on, starting on the one saved. */
export function DefaultAgentPick({ agents, current, onSubmit, onCancel }: DefaultAgentPickProps) {
  const [agent, setAgent] = useState(current && agents.includes(current) ? current : (agents[0] ?? ''));
  return (
    <FormShell title="Default agent" body="Hand-offs in this worktree go to this agent without asking." submit="Save"
      answers={agent ? { agent } : undefined} onSubmit={onSubmit} onCancel={onCancel}>
      <select aria-label="Agent" value={agent} autoFocus onChange={event => setAgent((event.target as HTMLSelectElement).value)}>
        {agents.map(key => <option key={key} value={key}>{key}</option>)}
      </select>
    </FormShell>
  );
}

export interface SetUpPickProps { agents: string[]; onSubmit(answers: Answers): void; onCancel(): void }

/** The agents to install the skills for; none installs the shared skills folder alone. */
export function SetUpPick({ agents, onSubmit, onCancel }: SetUpPickProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const flip = (agent: string) => setPicked(current => (current.includes(agent) ? current.filter(a => a !== agent) : [...current, agent]));
  return (
    <FormShell title="Set Up steno" body="Install the skills for these agents. With none picked, only the shared skills folder is set up."
      submit="Set Up" answers={setUpAnswers(agents, picked)} onSubmit={onSubmit} onCancel={onCancel}>
      {agents.map(agent => (
        <label key={agent} class="choice"><input type="checkbox" checked={picked.includes(agent)} onChange={() => flip(agent)} />{agent}</label>
      ))}
    </FormShell>
  );
}

export interface ReopenConfirmProps { target: ReopenTarget; onAnswer(reopen: boolean): void }

/** Reopening undoes a step the user took on purpose, so it asks first and says what stays. */
export function ReopenConfirm({ target, onAnswer }: ReopenConfirmProps) {
  const { title, body } = reopenWording(target);
  return (
    <div class="bar form" role="alertdialog" aria-label={title} onKeyDown={event => { if (event.key === 'Escape') onAnswer(false); }}>
      <div class="bar-text">
        <div class="form-title">{title}</div>
        <div class="form-body">{body}</div>
        <div class="form-buttons end">
          <button type="button" class="bar-button" onClick={() => onAnswer(false)}>Cancel</button>
          <button type="button" class="bar-button primary" autoFocus onClick={() => onAnswer(true)}>Reopen</button>
        </div>
      </div>
    </div>
  );
}

export interface RefusalBarProps { error: StructuredError; onDismiss(): void }

/** steno's reason for saying no, then each blocking problem with its file and line, which a one-line notice cannot hold. */
export function RefusalBar({ error, onDismiss }: RefusalBarProps) {
  const problems = refusalProblems(error);
  return (
    <div class="bar danger refusal" role="alert">
      <Icon name="TriangleAlert" />
      <div class="bar-text">
        <div>{error.message}</div>
        {problems.length ? <ul class="problems">{problems.map(line => <li key={line}>{line}</li>)}</ul> : null}
      </div>
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

/** A bar's close button, in its corner, so the text keeps the full width of a narrow sidebar. */
export function DismissButton({ onDismiss }: { onDismiss(): void }) {
  return <button type="button" class="icon-button dismiss" aria-label="Dismiss" data-label="Dismiss" onClick={onDismiss}><Icon name="X" size={14} /></button>;
}
