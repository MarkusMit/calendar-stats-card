export interface EntityConfig {
  entity: string;
  label?: string;
}

export interface CardConfig {
  type: string;
  entities: EntityConfig[];
}
