export type ThresholdOperator =
  | 'above' | 'equals-above' | 'equals-below' | 'below'
  | 'not-below' | 'not-above';

export type CellRole =
  | 'min' | 'avg' | 'max' | 'scalar'
  | 'summary-min' | 'summary-avg' | 'summary-max' | 'summary-scalar';

export interface ThresholdRule {
  operator: ThresholdOperator;
  value: number;
  name?: string;
  text_color?: string;
  background_color?: string;
}

/** One entity's triggered threshold rules, for the grouped legend. */
export interface ThresholdLegendGroup {
  label: string;          // entity display label incl. unit, e.g. "Temperature [°C]"
  rules: ThresholdRule[]; // triggered rules for this entity (object-deduped)
}

export interface PredecessorConfig {
  entity: string;
  replaced_on?: string; // ISO date YYYY-MM-DD; predecessor covers dates strictly before this
  factor?: number;      // multiplied onto all values; also bypasses unit compatibility check
}

export interface EntityRowConfig {
  entity: string;
  name?: string;
  precision?: number;
  factor?: number;
  unit?: string;
  show_zero?: boolean;
  show_min?: boolean;
  show_avg?: boolean;
  show_max?: boolean;
  text_color?: string;
  background_color?: string;
  thresholds?: ThresholdRule[];
  predecessors?: PredecessorConfig[];
}

export interface ExpressionRowConfig {
  expression: string;
  name?: string;
  unit?: string;
  precision?: number;
  show_zero?: boolean;
  text_color?: string;
  background_color?: string;
  thresholds?: ThresholdRule[];
}

export type EntityConfig = EntityRowConfig | ExpressionRowConfig;

export function rowKey(cfg: EntityConfig): string {
  return 'entity' in cfg ? cfg.entity : cfg.expression;
}

export interface CardConfig {
  type: string;
  entities: EntityConfig[];
}
