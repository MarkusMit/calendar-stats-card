export interface EntityRowConfig {
  entity: string;
  name?: string;
  precision?: number;
  factor?: number;
  unit?: string;
  show_zero?: boolean;
}

export interface ExpressionRowConfig {
  expression: string;
  name?: string;
  unit?: string;
  precision?: number;
  show_zero?: boolean;
}

export type EntityConfig = EntityRowConfig | ExpressionRowConfig;

export function rowKey(cfg: EntityConfig): string {
  return 'entity' in cfg ? cfg.entity : cfg.expression;
}

export interface CardConfig {
  type: string;
  entities: EntityConfig[];
}
