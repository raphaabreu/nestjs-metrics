import { AggregatedData, MetricCollector } from '../types';

export class SumCollector implements MetricCollector {
  private count: number | null = null;

  collect(value: number): void {
    this.count = (this.count ?? 0) + value;
  }

  drain(): AggregatedData[] {
    const count = this.count;
    this.count = null;

    if (count === null) {
      return [];
    }

    return [{ type: 'sum', value: count }];
  }
}
