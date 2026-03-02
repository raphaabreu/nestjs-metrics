export type AggregatedData =
  | { type: 'sum'; value: number }
  | { type: 'statisticSet'; min: number; max: number; sum: number; count: number }
  | { type: 'values'; values: number[]; counts: number[] };

export interface CollectedMetricData {
  name: string;
  labels: Record<string, string>;
  unit?: string;
  namespace?: string;
  data: AggregatedData[];
  collectedAt: Date;
}

export interface MetricCollector {
  collect(value: number): void;
  drain(): AggregatedData[];
}

export interface MetricRecorder {
  record(value: number | number[], labels?: Record<string, string> | Record<string, string>[]): void;
}

export interface MetricDestination {
  flush(metrics: CollectedMetricData[]): Promise<void>;
}

export interface MetricOptions {
  unit?: string;
  namespace?: string;
}

export interface MetricModuleOptions {
  destination: MetricDestination;
  flushIntervalMs?: number;
  flushOnRequest?: boolean;
}

export const METRIC_MODULE_OPTIONS = Symbol('METRIC_MODULE_OPTIONS');
