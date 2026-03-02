import { Injectable } from '@nestjs/common';
import { CollectedMetricData, MetricCollector } from './types';

@Injectable()
export abstract class Metric {
  abstract readonly name: string;
  readonly unit?: string;
  readonly namespace?: string;

  private readonly collectors = new Map<string, { labels: Record<string, string>; collector: MetricCollector }>();

  protected abstract createCollector(): MetricCollector;

  record(value: number | number[], labels?: Record<string, string> | Record<string, string>[]): void {
    const labelSets = labels === undefined ? [{}] : Array.isArray(labels) ? labels : [labels];

    for (const labelSet of labelSets) {
      const collector = this.getCollector(labelSet);

      if (Array.isArray(value)) {
        for (const v of value) {
          collector.collect(v);
        }
      } else {
        collector.collect(value);
      }
    }
  }

  flush(): CollectedMetricData[] {
    const results: CollectedMetricData[] = [];
    const now = new Date();

    for (const [, entry] of this.collectors) {
      const data = entry.collector.drain();
      if (data.length > 0) {
        const item: CollectedMetricData = {
          name: this.name,
          labels: entry.labels,
          data,
          collectedAt: now,
        };
        if (this.unit !== undefined) {
          item.unit = this.unit;
        }
        if (this.namespace !== undefined) {
          item.namespace = this.namespace;
        }
        results.push(item);
      }
    }

    return results;
  }

  private getCollector(labels: Record<string, string>): MetricCollector {
    const key = this.serializeLabels(labels);

    let entry = this.collectors.get(key);
    if (!entry) {
      entry = { labels, collector: this.createCollector() };
      this.collectors.set(key, entry);
    }

    return entry.collector;
  }

  private serializeLabels(labels: Record<string, string>): string {
    const sortedKeys = Object.keys(labels).sort();
    if (sortedKeys.length === 0) {
      return '';
    }
    return sortedKeys.map((k) => `${k}=${labels[k]}`).join('&');
  }
}
