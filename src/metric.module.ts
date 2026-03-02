import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MetricFlushService } from './metric-flush.service';
import { METRIC_MODULE_OPTIONS, MetricModuleOptions } from './types';

@Module({})
export class MetricModule {
  static register(options: MetricModuleOptions): DynamicModule {
    return {
      module: MetricModule,
      global: true,
      imports: [DiscoveryModule],
      providers: [
        { provide: METRIC_MODULE_OPTIONS, useValue: options },
        MetricFlushService,
      ],
      exports: [MetricFlushService],
    };
  }
}
