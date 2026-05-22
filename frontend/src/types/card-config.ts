export interface EntityRowConfig {
  entity: string;
  name?: string;
  precision?: number;
  factor?: number;
  unit?: string;
}

export interface ExpressionRowConfig {
  expression: string;
  name?: string;
  unit?: string;
  precision?: number;
}

export type EntityConfig = EntityRowConfig | ExpressionRowConfig;

export function rowKey(cfg: EntityConfig): string {
  return 'entity' in cfg ? cfg.entity : cfg.expression;
}

export interface CardConfig {
  type: string;
  entities: EntityConfig[];
}
