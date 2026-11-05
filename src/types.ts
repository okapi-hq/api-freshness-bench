/**
 * Okapi Bench's vocabulary. A task asks a model for code that calls a
 * third-party API; its slots are the choices that code must make (a model id,
 * an endpoint, an SDK, a parameter); each rule recognises one value of a slot
 * and carries the fact Okapi knows about it.
 */

/** What a call gets today, as Okapi's call statuses say it (`call-status.ts`). */
export const STATUSES = ['ok', 'deprecated', 'at_risk', 'broken'] as const;
export type Status = (typeof STATUSES)[number];

/** A finding nothing in the knowledge base explains: reviewed by hand, then added. */
export type Verdict = Status | 'unknown';

/**
 * What the provider said will happen, as Okapi's archive words it:
 * `fails` on `effective` (no date: an undated removal, deprecated),
 * `redirected` (answered from a newer version past its day), `keeps_working`
 * (an undated deprecation), `ok` (current), `invalid` (never existed or not
 * served: fails today).
 */
export type Outcome = 'ok' | 'fails' | 'redirected' | 'keeps_working' | 'invalid';

export interface Fact {
  outcome: Outcome;
  /** The day calls stop working (or are redirected). */
  effective?: string;
  /** The day the provider announced it: what tells a change a model could know. */
  announced?: string;
  /** The day the thing was released, for a current value. */
  released?: string;
  source: string;
  quote?: string;
  /** What to do instead, or what happens. */
  note?: string;
  /** Where the fact comes from. */
  origin: 'okapi' | 'provider' | 'registry' | 'changelog';
}

/** A dependency constraint a rule depends on: the majors the manifest lets install. */
export interface SdkGate {
  /** Package name as the manifest writes it. */
  pkg: string;
  /** The first major where the recognised code stops working. */
  breaksFrom: number;
  /** The fact when the manifest keeps the package below `breaksFrom`. */
  pinned: Fact;
}

export interface Rule {
  /** Stable within its slot. */
  id: string;
  /** How a reader names the value (`gpt-4o-mini`, `files.upload`). */
  label: string;
  /** A regular expression source, matched on the code with comments removed. */
  pattern: string;
  flags?: string;
  /** Where to look: the code (default) or the dependency manifests. */
  scope?: 'code' | 'manifest';
  /** Applies only when every listed rule (`slot.rule`) matched too. */
  requires?: string[];
  /** Applies only when at least one listed rule matched too (a model of a family). */
  requiresAny?: string[];
  /** Applies only when none of the listed rules matched. */
  unless?: string[];
  sdk?: SdkGate;
  fact: Fact;
}

export interface Slot {
  id: string;
  label: string;
  rules: Rule[];
  /**
   * Values that look like this slot's but match no rule (a model id nobody
   * listed): each is an `unknown` finding for review. Its first group is the value.
   */
  candidate?: string;
  candidateFlags?: string;
  /**
   * What a candidate no rule explains is, when the slot's rules list every
   * valid value (a gateway's whole model list): not served, so it fails.
   */
  unknownAs?: Fact;
  /**
   * No rule matched and no candidate: fine (`ok`), the slot went unanswered
   * (`missing`, reviewed by hand), or the code cannot work without it (`broken`:
   * an A2A client that sends no A2A method at all).
   */
  absent: 'ok' | 'missing' | 'broken';
  /** Why an empty slot breaks the code, for `absent: 'broken'`. */
  absentNote?: string;
}

export const STYLES = ['sdk', 'rest', 'mcp', 'a2a'] as const;
export type Style = (typeof STYLES)[number];

export interface Task {
  id: string;
  title: string;
  /** Okapi's provider category (`PROVIDER_CATEGORIES`), `protocol` for MCP and A2A. */
  category: string;
  provider: string;
  language: string;
  style: Style;
  prompt: string;
  /** The breaking change the task is built around, and where the fact comes from. */
  evidence: string;
  slots: Slot[];
}

/** One value a graded answer contains, and what Okapi knows of it. */
export interface Finding {
  slot: string;
  rule: string | null;
  label: string;
  verdict: Verdict;
  fact: Fact | null;
  /** The text that matched, trimmed. */
  excerpt: string;
}

export interface TaskGrade {
  task: string;
  verdict: Verdict | 'missing';
  findings: Finding[];
  /** Slots nothing in the answer filled. */
  missing: string[];
  /** The prose around the code says something is retired, deprecated or sunset. */
  warned: boolean;
}
