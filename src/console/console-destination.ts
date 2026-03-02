import { Logger } from '@nestjs/common';
import { CollectedMetricData, MetricDestination } from '../types';

export class ConsoleDestination implements MetricDestination {
  private readonly logger = new Logger(ConsoleDestination.name);

  async flush(metrics: CollectedMetricData[]): Promise<void> {
    for (const metric of metrics) {
      const labelStr = Object.keys(metric.labels).length > 0
        ? ` [${Object.entries(metric.labels).map(([k, v]) => `${k}=${v}`).join(', ')}]`
        : '';

      for (const data of metric.data) {
        switch (data.type) {
          case 'sum':
            this.logger.log(`${metric.name}${labelStr}: sum=${data.value}`);
            break;
          case 'statisticSet':
            this.logger.log(
              `${metric.name}${labelStr}: min=${data.min} max=${data.max} sum=${data.sum} count=${data.count}`,
            );
            break;
          case 'values':
            this.logger.log(
              `${metric.name}${labelStr}: ${data.values.length} distinct value(s)`,
            );
            break;
        }
      }
    }
  }
}
