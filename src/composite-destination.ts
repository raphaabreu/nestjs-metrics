import { CollectedMetricData, MetricDestination } from './types';

export class CompositeDestination implements MetricDestination {
  private readonly destinations: MetricDestination[];

  constructor(destinations: MetricDestination[]) {
    this.destinations = destinations;
  }

  async flush(metrics: CollectedMetricData[]): Promise<void> {
    await Promise.all(this.destinations.map((d) => d.flush(metrics)));
  }
}
