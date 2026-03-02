import { DiscoveryService } from '@nestjs/core';
import { MetricFlushService } from './metric-flush.service';
import { Metric } from './metric';
import { MetricCollector, MetricDestination, MetricModuleOptions } from './types';
import { SumCollector } from './collectors';

class TestMetric extends Metric {
  name = 'TestMetric';
  unit = 'Count';

  protected createCollector(): MetricCollector {
    return new SumCollector();
  }
}

describe('MetricFlushService', () => {
  let service: MetricFlushService;
  let destination: jest.Mocked<MetricDestination>;
  let testMetric: TestMetric;

  beforeEach(() => {
    testMetric = new TestMetric();

    destination = {
      flush: jest.fn().mockResolvedValue(undefined),
    };

    const options: MetricModuleOptions = {
      destination,
      flushIntervalMs: 60000,
    };

    const discoveryService = {
      getProviders: jest.fn().mockReturnValue([
        { instance: testMetric },
        { instance: {} }, // non-metric provider
        { instance: null }, // null instance
      ]),
    } as unknown as DiscoveryService;

    service = new MetricFlushService(discoveryService, options);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should discover metrics on bootstrap', () => {
    service.onApplicationBootstrap();
    // Should not throw - metrics discovered successfully
  });

  it('should flush collected data to destination', async () => {
    service.onApplicationBootstrap();
    testMetric.record(42);

    await service.flush();

    expect(destination.flush).toHaveBeenCalledTimes(1);
    const flushedData = destination.flush.mock.calls[0][0];
    expect(flushedData).toHaveLength(1);
    expect(flushedData[0].name).toBe('TestMetric');
    expect(flushedData[0].data).toEqual([{ type: 'sum', value: 42 }]);
  });

  it('should not call destination when no data collected', async () => {
    service.onApplicationBootstrap();
    await service.flush();
    expect(destination.flush).not.toHaveBeenCalled();
  });

  it('should isolate errors between metrics', async () => {
    const badMetric = new TestMetric();
    jest.spyOn(badMetric, 'flush').mockImplementation(() => {
      throw new Error('metric error');
    });

    const discoveryService = {
      getProviders: jest.fn().mockReturnValue([
        { instance: badMetric },
        { instance: testMetric },
      ]),
    } as unknown as DiscoveryService;

    const options: MetricModuleOptions = { destination, flushIntervalMs: 60000 };
    service = new MetricFlushService(discoveryService, options);
    service.onApplicationBootstrap();

    testMetric.record(10);
    await service.flush();

    expect(destination.flush).toHaveBeenCalledTimes(1);
    const flushedData = destination.flush.mock.calls[0][0];
    expect(flushedData).toHaveLength(1);
    expect(flushedData[0].data).toEqual([{ type: 'sum', value: 10 }]);
  });

  it('should perform final flush on destroy', async () => {
    service.onApplicationBootstrap();
    testMetric.record(99);

    await service.onModuleDestroy();

    expect(destination.flush).toHaveBeenCalledTimes(1);
    const flushedData = destination.flush.mock.calls[0][0];
    expect(flushedData).toHaveLength(1);
    expect(flushedData[0].data).toEqual([{ type: 'sum', value: 99 }]);
  });
});
