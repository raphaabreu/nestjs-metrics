import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { MetricFlushService } from './metric-flush.service';
import { MetricFlushInterceptor } from './metric-flush.interceptor';
import { MetricRegistry } from './metric-registry';
import { METRIC_MODULE_OPTIONS, MetricModuleOptions } from './types';

@Module({})
export class MetricModule {
  static register(options: MetricModuleOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: METRIC_MODULE_OPTIONS, useValue: options },
      MetricFlushService,
      MetricRegistry,
    ];

    if (options.flushOnRequest) {
      providers.push({ provide: APP_INTERCEPTOR, useClass: MetricFlushInterceptor });
    }

    return {
      module: MetricModule,
      global: true,
      imports: [DiscoveryModule],
      providers,
      exports: [MetricFlushService, MetricRegistry],
    };
  }
}
