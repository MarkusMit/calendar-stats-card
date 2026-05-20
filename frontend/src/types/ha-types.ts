export interface HassEntityAttributes {
  friendly_name?: string;
  state_class?: string;
  device_class?: string;
  unit_of_measurement?: string;
  [key: string]: unknown;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: HassEntityAttributes;
}

export interface HassConfig {
  version: string;
  time_zone: string;
  [key: string]: unknown;
}

export interface HassConnection {
  sendMessagePromise<T>(message: Record<string, unknown>): Promise<T>;
}

export interface HomeAssistant {
  config: HassConfig;
  states: Record<string, HassEntity>;
  connection: HassConnection;
  selectedLanguage?: string;
  language: string;
}
