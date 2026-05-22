export interface EntityConfig {
  entity: string;
  name?: string;
  precision?: number;
}

export interface CardConfig {
  type: string;
  entities: EntityConfig[];
}
