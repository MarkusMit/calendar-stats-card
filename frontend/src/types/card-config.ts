export interface PredecessorConfig {
  entity: string;
  replaced_on?: string; // ISO date YYYY-MM-DD; predecessor covers dates strictly before this
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
}

export type EntityConfig = EntityRowConfig | ExpressionRowConfig;

export function rowKey(cfg: EntityConfig): string {
  return 'entity' in cfg ? cfg.entity : cfg.expression;
}

export interface CardConfig {
  type: string;
  entities: EntityConfig[];
}
