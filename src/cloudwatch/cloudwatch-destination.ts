import {
  CloudWatchClient,
  Dimension,
  MetricDatum,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { Logger } from '@nestjs/common';
import { PromiseCollector } from '@raphaabreu/promise-collector';
import { AggregatedData, CollectedMetricData, MetricDestination } from '../types';

export interface CloudWatchDestinationOptions {
  namespace: string;
  client?: CloudWatchClient;
}

export class CloudWatchDestination implements MetricDestination {
  private readonly logger = new Logger(CloudWatchDestination.name);
  private readonly client: CloudWatchClient;
  private readonly namespace: string;
  private readonly promiseCollector = new PromiseCollector();

  constructor(options: CloudWatchDestinationOptions) {
    this.namespace = options.namespace;
    this.client = options.client ?? new CloudWatchClient({});
  }

  async flush(metrics: CollectedMetricData[]): Promise<void> {
    // Group by namespace since each PutMetricDataCommand targets a single namespace
    const byNamespace = new Map<string, MetricDatum[]>();

    for (const metric of metrics) {
      const ns = metric.namespace ?? this.namespace;
      const dimensions = this.toDimensions(metric.labels);

      for (const data of metric.data) {
        const datum = this.toDatum(metric.name, dimensions, metric.unit, metric.collectedAt, data);
        let list = byNamespace.get(ns);
        if (!list) {
          list = [];
          byNamespace.set(ns, list);
        }
        list.push(datum);
      }
    }

    if (byNamespace.size === 0) {
      return;
    }

    const commands: PutMetricDataCommand[] = [];
    for (const [ns, metricData] of byNamespace) {
      commands.push(...this.splitBySize(metricData, ns));
    }

    let totalDatum = 0;
    for (const data of byNamespace.values()) {
      totalDatum += data.length;
    }
    this.logger.debug(`Sending ${totalDatum} metric datum(s) in ${commands.length} command(s)`);

    const promise = Promise.all(commands.map((cmd) => this.send(cmd)));
    this.promiseCollector.add(promise);
    await this.promiseCollector.pending();
  }

  private toDimensions(labels: Record<string, string>): Dimension[] {
    return Object.entries(labels).map(([Name, Value]) => ({ Name, Value }));
  }

  private toDatum(
    name: string,
    dimensions: Dimension[],
    unit: string | undefined,
    timestamp: Date,
    data: AggregatedData,
  ): MetricDatum {
    const base: MetricDatum = {
      MetricName: name,
      Dimensions: dimensions,
      Unit: (unit as StandardUnit) ?? 'None',
      Timestamp: timestamp,
    };

    switch (data.type) {
      case 'sum':
        return { ...base, Value: data.value };
      case 'statisticSet':
        return {
          ...base,
          StatisticValues: {
            Minimum: data.min,
            Maximum: data.max,
            Sum: data.sum,
            SampleCount: data.count,
          },
        };
      case 'values':
        return {
          ...base,
          Values: data.values,
          Counts: data.counts,
        };
    }
  }

  private splitBySize(metricData: MetricDatum[], namespace: string): PutMetricDataCommand[] {
    const commands: PutMetricDataCommand[] = [];
    const remaining = [...metricData];

    while (remaining.length > 0) {
      let byteSize = 0;
      const chunk: MetricDatum[] = [];

      while (remaining.length > 0) {
        const datum = remaining[0];
        const datumSize = JSON.stringify(datum).length;

        if (chunk.length > 0 && byteSize + datumSize > 100 * 1024) {
          break;
        }

        chunk.push(remaining.shift()!);
        byteSize += datumSize;
      }

      commands.push(
        new PutMetricDataCommand({
          MetricData: chunk,
          Namespace: namespace,
        }),
      );
    }

    return commands;
  }

  private async send(command: PutMetricDataCommand): Promise<void> {
    try {
      await this.client.send(command);
    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      this.logger.error('Error sending metrics to CloudWatch', err.stack ?? String(err));

      if (err.name === '413' && command.input.MetricData && command.input.MetricData.length > 1) {
        this.logger.debug(`Splitting ${command.input.MetricData.length} metric data to retry`);

        const metricData = command.input.MetricData;
        const middleIndex = Math.ceil(metricData.length / 2);

        const firstHalf = new PutMetricDataCommand({
          ...command.input,
          MetricData: metricData.slice(0, middleIndex),
        });

        const secondHalf = new PutMetricDataCommand({
          ...command.input,
          MetricData: metricData.slice(middleIndex),
        });

        await Promise.all([this.send(firstHalf), this.send(secondHalf)]);
      }
    }
  }
}
