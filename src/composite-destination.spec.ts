import { CompositeDestination } from './composite-destination';
import { CollectedMetricData, MetricDestination } from './types';

describe('CompositeDestination', () => {
  it('should call flush on all destinations', async () => {
    const dest1: jest.Mocked<MetricDestination> = { flush: jest.fn().mockResolvedValue(undefined) };
    const dest2: jest.Mocked<MetricDestination> = { flush: jest.fn().mockResolvedValue(undefined) };

    const composite = new CompositeDestination([dest1, dest2]);
    const metrics: CollectedMetricData[] = [
      {
        name: 'Test',
        labels: {},
        data: [{ type: 'sum', value: 1 }],
        collectedAt: new Date(),
      },
    ];

    await composite.flush(metrics);

    expect(dest1.flush).toHaveBeenCalledWith(metrics);
    expect(dest2.flush).toHaveBeenCalledWith(metrics);
  });

  it('should handle empty destination list', async () => {
    const composite = new CompositeDestination([]);
    await composite.flush([]);
    // should not throw
  });
});
