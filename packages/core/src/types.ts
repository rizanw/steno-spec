export interface Criterion { id: string; n: number; text: string; line: number }

export interface Requirement {
  id: string; n: number; title: string; story?: string;
  criteria: Criterion[]; line: number; endLine: number;
}

export interface GlossaryTerm { term: string; definition: string; line: number }

export interface RequirementsDoc { title: string; intro?: string; glossary: GlossaryTerm[]; requirements: Requirement[]; raw: string }

export interface DesignSection {
  id?: string; heading: string; level: number; satisfies: string[];
  line: number; endLine: number; body: string;
}

export interface DesignDoc { title: string; sections: DesignSection[]; raw: string }

export interface Task {
  id: string; num: string; title: string; done: boolean; optional: boolean;
  checkpoint: boolean;
  requirements: string[]; design: string[]; line: number; depth: number;
  parent?: string; children: string[];
}

export interface TasksDoc { title: string; tasks: Task[]; raw: string }

export type Phase = 'brief' | 'requirements' | 'design' | 'tasks' | 'execute' | 'done';

export const PHASES: Phase[] = ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'];

export interface SpecState {
  name: string;
  title?: string;
  kind: 'feature' | 'bugfix';
  mode: 'gated' | 'quick';
  phase: Phase;
  created: string;
  approvals: Partial<Record<'requirements' | 'design' | 'tasks', string>>;
}

export interface LintIssue {
  level: 'error' | 'warn';
  rule: string;
  file: string;
  line?: number;
  id?: string;
  msg: string;
}

export interface Spec {
  root: string;        // absolute path to spec dir
  state: SpecState;
  requirements?: RequirementsDoc;
  design?: DesignDoc;
  tasks?: TasksDoc;
  brief?: string;
  files: Record<string, string>; // filename -> raw text
}
