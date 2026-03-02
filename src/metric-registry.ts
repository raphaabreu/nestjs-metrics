import { Injectable } from '@nestjs/common';
import { Metric } from './metric';
import { CollectedMetricData, MetricCollector, MetricOptions, MetricRecorder } from './types';
import { SumCollector, StatisticSetCollector, ValuesCollector } from './collectors';

class RegistryMetric extends Metric {
  readonly name: string;
  readonly unit?: string;
  readonly namespace?: string;

  constructor(
    name: string,
    private readonly collectorFactory: () => MetricCollector,
    options?: MetricOptions,
  ) {
    super();
    this.name = name;
    this.unit = options?.unit;
    this.namespace = options?.namespace;
  }

  protected createCollector(): MetricCollector {
    return this.collectorFactory();
  }
}

@Injectable()
export class MetricRegistry {
  private readonly metrics: Metric[] = [];

  sum(name: string, options?: MetricOptions): MetricRecorder {
    const metric = new RegistryMetric(name, () => new SumCollector(), options);
    this.metrics.push(metric);
    return metric;
  }

  statisticSet(name: string, options?: MetricOptions): MetricRecorder {
    const metric = new RegistryMetric(name, () => new StatisticSetCollector(), options);
    this.metrics.push(metric);
    return metric;
  }

  values(name: string, options?: MetricOptions): MetricRecorder {
    const metric = new RegistryMetric(name, () => new ValuesCollector(), options);
    this.metrics.push(metric);
    return metric;
  }

  flush(): CollectedMetricData[] {
    const results: CollectedMetricData[] = [];
    for (const metric of this.metrics) {
      results.push(...metric.flush());
    }
    return results;
  }
}
