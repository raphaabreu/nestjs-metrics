import { ConsoleDestination } from './console-destination';
import { CollectedMetricData } from '../types';

describe('ConsoleDestination', () => {
  let destination: ConsoleDestination;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    destination = new ConsoleDestination();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logSpy = jest.spyOn((destination as any).logger, 'log').mockImplementation();
  });

  it('should log sum metrics', async () => {
    const metrics: CollectedMetricData[] = [
      {
        name: 'RequestCount',
        labels: {},
        unit: 'Count',
        data: [{ type: 'sum', value: 42 }],
        collectedAt: new Date(),
      },
    ];

    await destination.flush(metrics);

    expect(logSpy).toHaveBeenCalledWith('RequestCount: sum=42');
  });

  it('should log statisticSet metrics', async () => {
    const metrics: CollectedMetricData[] = [
      {
        name: 'Latency',
        labels: { env: 'prod' },
        unit: 'Milliseconds',
        data: [{ type: 'statisticSet', min: 5, max: 100, sum: 500, count: 10 }],
        collectedAt: new Date(),
      },
    ];

    await destination.flush(metrics);

    expect(logSpy).toHaveBeenCalledWith('Latency [env=prod]: min=5 max=100 sum=500 count=10');
  });

  it('should log values metrics', async () => {
    const metrics: CollectedMetricData[] = [
      {
        name: 'ResponseTime',
        labels: {},
        data: [{ type: 'values', values: [1, 2, 3], counts: [10, 20, 30] }],
        collectedAt: new Date(),
      },
    ];

    await destination.flush(metrics);

    expect(logSpy).toHaveBeenCalledWith('ResponseTime: 3 distinct value(s)');
  });

  it('should handle empty metrics', async () => {
    await destination.flush([]);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
