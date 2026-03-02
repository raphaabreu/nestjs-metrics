import { AggregatedData, MetricCollector } from '../types';

interface StatisticSet {
  max: number;
  min: number;
  sum: number;
  count: number;
}

export class StatisticSetCollector implements MetricCollector {
  private statisticSet: StatisticSet | null = null;

  collect(value: number): void {
    if (!this.statisticSet) {
      this.statisticSet = {
        max: value,
        min: value,
        sum: value,
        count: 1,
      };
    } else {
      const set = this.statisticSet;
      set.max = Math.max(set.max, value);
      set.min = Math.min(set.min, value);
      set.sum += value;
      set.count++;
    }
  }

  drain(): AggregatedData[] {
    const set = this.statisticSet;
    this.statisticSet = null;

    if (!set) {
      return [];
    }

    return [
      {
        type: 'statisticSet',
        min: set.min,
        max: set.max,
        sum: set.sum,
        count: set.count,
      },
    ];
  }
}
