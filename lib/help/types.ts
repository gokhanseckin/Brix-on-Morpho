import type { SidebarInputs } from '@/types/simulator';

export interface ParamHelp {
  /** One short line. What it controls + directional consequence. */
  oneLiner: string;
  /** Rich body rendered on /help/<section>#<paramKey>. Optional. */
  details?: ParamDetails;
}

export interface ParamDetails {
  /** Long-form paragraph(s) describing the parameter in depth. */
  description?: string;
  /** Enum-like values for select/toggle params. */
  options?: Array<{ name: string; description: string; bestFor?: string }>;
  /** What downstream sections recompute when this param changes. */
  downstream?: Array<{ section: string; effects: string[] }>;
  /** What stays the same when this changes. */
  unchanged?: string[];
}

export type ParamSource = 'sidebar' | 'derived' | 'constant';

export interface FormulaSpec {
  /** Monospace, rendered in popover. */
  plain: string;
  /** KaTeX, rendered on /help (falls back to plain if absent). */
  latex?: string;
}

export interface KpiHelpParam {
  name: string;
  source: ParamSource;
  ref?: keyof SidebarInputs;
  /** For constants: e.g. "$1", "0.20". */
  value?: string;
  note?: string;
}

export interface KpiImpact {
  health: string;
  sustainability: string;
  profitability: string;
}

export interface KpiHelp {
  title: string;
  oneLiner: string;
  formula: FormulaSpec;
  params: KpiHelpParam[];
  definitions: Array<{ term: string; definition: string }>;
  impact: KpiImpact;
  /** Worked example. Rendered only on /help. */
  workedExample?: {
    description: string;
    steps: Array<{
      label: string;
      expression: string;
      usesInputs: Array<keyof SidebarInputs>;
    }>;
  };
  /** Chart key to render under the entry on /help. */
  chart?: { component: string };
  /** Raw mermaid syntax, rendered on /help. */
  diagram?: { mermaid: string };
  /** Reserved for future cross-references. Not rendered in PR #1. */
  related?: string[];
}

export interface ChartHelp extends Omit<KpiHelp, 'formula' | 'params'> {
  axes: { x: string; y: string };
  bands?: Array<{ name: string; meaning: string }>;
}

/** Which dashboard section a KPI/chart belongs to (drives /help anchor link). */
export type HelpSection =
  | 'liquidity-need'
  | 'fx-risk'
  | 'strategy'
  | 'liquidation'
  | 'vault'
  | 'utilization';
