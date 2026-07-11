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

/** A month within a year. `month` is 1-12. */
export interface MonthAnchor {
  year: number;
  month: number;
}

export type RangePreset =
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_3_months'
  | 'last_12_months'
  | 'last_year'
  | 'last_3_years'
  | 'last_5_years'
  | 'all'
  | 'custom';

/** Inclusive month-to-month range. `preset` drives the label and stepping unit. */
export interface DateRange {
  start: MonthAnchor;
  end: MonthAnchor;
  preset: RangePreset;
}

/** Which presentation is active: monthly (day-by-day) or yearly (month-by-month). */
export type ViewMode = 'monthly' | 'yearly';

/**
 * Per-row yearly roll-up (derived at render time, never stored).
 * Measurement rows: min/max are extremes of the monthly extremes, mean is the
 * day-weighted yearly mean, total is null. Cumulative rows: stats over the
 * monthly totals plus their sum as total.
 */
export interface YearlyRollup {
  min: number | null;
  mean: number | null;
  max: number | null;
  total: number | null;
}

export interface ViewState {
  range: DateRange;
  viewMode: ViewMode;
  earliestDataYear: number | null;
  earliestDataMonth: number | null;
  isLoading: boolean;
  statisticsByYear: Map<number, YearStatistics>;
  entityErrors: Set<string>;
}
