import { AggregatedData, MetricCollector } from '../types';

export class ValuesCollector implements MetricCollector {
  private data: Record<string, number> = {};

  collect(value: number): void {
    const key = value.toFixed(3);
    this.data[key] = (this.data[key] ?? 0) + 1;
  }

  drain(): AggregatedData[] {
    const data = this.data;
    this.data = {};

    const values = Object.keys(data);
    const counts = Object.values(data);

    if (values.length === 0) {
      return [];
    }

    const response: AggregatedData[] = [];

    while (values.length > 0) {
      const valuePart = values.splice(0, 150);
      const countPart = counts.splice(0, 150);

      response.push({
        type: 'values',
        values: valuePart.map((v) => parseFloat(v)),
        counts: countPart,
      });
    }

    return response;
  }
}
