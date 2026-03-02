import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Metric } from './metric';
import { CollectedMetricData, METRIC_MODULE_OPTIONS, MetricModuleOptions } from './types';

@Injectable()
export class MetricFlushService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MetricFlushService.name);
  private metrics: Metric[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private flushing = false;

  constructor(
    private readonly discoveryService: DiscoveryService,
    @Inject(METRIC_MODULE_OPTIONS) private readonly options: MetricModuleOptions,
  ) {}

  onApplicationBootstrap(): void {
    this.metrics = this.discoveryService
      .getProviders()
      .filter((wrapper) => wrapper.instance instanceof Metric)
      .map((wrapper) => wrapper.instance as Metric);

    this.logger.log(`Discovered ${this.metrics.length} metric(s)`);

    const intervalMs = this.options.flushIntervalMs ?? 55000;
    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        this.logger.error('Flush failed', err instanceof Error ? err.stack : String(err));
      });
    }, intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;

    try {
      const allData: CollectedMetricData[] = [];

      for (const metric of this.metrics) {
        try {
          const data = metric.flush();
          allData.push(...data);
        } catch (err) {
          this.logger.error(
            `Error flushing metric "${(metric as Metric).name}"`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }

      if (allData.length === 0) {
        return;
      }

      this.logger.debug(`Flushing ${allData.length} metric data point(s)`);
      await this.options.destination.flush(allData);
    } finally {
      this.flushing = false;
    }
  }
}
