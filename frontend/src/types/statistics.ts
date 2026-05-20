export interface EntityMetadata {
  entityId: string;
  stateClass: 'measurement' | 'total_increasing' | 'total' | 'unknown';
  deviceClass: string | null;
  unitOfMeasurement: string | null;
  friendlyName: string | null;
  hasStatistics: boolean;
}

export interface MeasurementDailyValue {
  kind: 'measurement';
  entityId: string;
  date: string;
  min: number;
  mean: number;
  max: number;
  partialCoverage: boolean;
}

export interface CumulativeDailyValue {
  kind: 'cumulative';
  entityId: string;
  date: string;
  sum: number;
  partialCoverage: boolean;
}

export interface EmptyDailyValue {
  kind: 'empty';
  entityId: string;
  date: string;
}

export type DailyValue = MeasurementDailyValue | CumulativeDailyValue | EmptyDailyValue;

export interface MonthlySummary {
  entityId: string;
  year: number;
  month: number;
  min: number | null;
  mean: number | null;
  max: number | null;
  total: number | null;
}

export interface YearStatistics {
  dailyValues: Map<string, DailyValue>;
  monthlySummaries: Map<string, MonthlySummary>;
  entityMetadata: Map<string, EntityMetadata>;
}

export interface ViewState {
  selectedYear: number;
  earliestDataYear: number | null;
  earliestDataMonth: number | null;
  isLoading: boolean;
  statisticsByYear: Map<number, YearStatistics>;
  entityErrors: Set<string>;
}
