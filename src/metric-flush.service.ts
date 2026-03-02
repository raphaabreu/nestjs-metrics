import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Metric } from './metric';
import { MetricRegistry } from './metric-registry';
import { CollectedMetricData, METRIC_MODULE_OPTIONS, MetricModuleOptions } from './types';

@Injectable()
export class MetricFlushService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MetricFlushService.name);
  private metrics: Metric[] = [];
  private registries: MetricRegistry[] = [];
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

    this.registries = this.discoveryService
      .getProviders()
      .filter((wrapper) => wrapper.instance instanceof MetricRegistry)
      .map((wrapper) => wrapper.instance as MetricRegistry);

    this.logger.log(
      `Discovered ${this.metrics.length} metric(s) and ${this.registries.length} registry(ies)`,
    );

    const intervalMs = this.options.flushIntervalMs ?? 55000;
    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        this.logger.error('Flush failed', err instanceof Error ? err.stack : String(err));
      });
    }, intervalMs);

    process.once('SIGTERM', () => this.flush());
    process.once('SIGINT', () => this.flush());
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
            `Error flushing metric "${metric.name}"`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }

      for (const registry of this.registries) {
        try {
          const data = registry.flush();
          allData.push(...data);
        } catch (err) {
          this.logger.error(
            'Error flushing metric registry',
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
