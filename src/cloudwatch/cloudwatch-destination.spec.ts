import { CloudWatchDestination } from './cloudwatch-destination';
import { CollectedMetricData } from '../types';

const mockSend = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-cloudwatch', () => {
  const actual = jest.requireActual('@aws-sdk/client-cloudwatch');
  return {
    ...actual,
    CloudWatchClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

describe('CloudWatchDestination', () => {
  let destination: CloudWatchDestination;

  beforeEach(() => {
    mockSend.mockClear();
    destination = new CloudWatchDestination({ namespace: 'test/app' });
  });

  it('should not send when no metrics', async () => {
    await destination.flush([]);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should map sum data correctly', async () => {
    const metrics: CollectedMetricData[] = [
      {
        name: 'RequestCount',
        labels: { env: 'prod' },
        unit: 'Count',
        data: [{ type: 'sum', value: 42 }],
        collectedAt: new Date('2024-01-01'),
      },
    ];

    await destination.flush(metrics);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input.Namespace).toBe('test/app');
    expect(command.input.MetricData).toHaveLength(1);

    const datum = command.input.MetricData[0];
    expect(datum.MetricName).toBe('RequestCount');
    expect(datum.Value).toBe(42);
    expect(datum.Unit).toBe('Count');
    expect(datum.Dimensions).toEqual([{ Name: 'env', Value: 'prod' }]);
  });

  it('should map statisticSet data correctly', async () => {
    const metrics: CollectedMetricData[] = [
      {
        name: 'Latency',
        labels: {},
        unit: 'Milliseconds',
        data: [{ type: 'statisticSet', min: 5, max: 100, sum: 500, count: 10 }],
        collectedAt: new Date('2024-01-01'),
      },
    ];

    await destination.flush(metrics);

    const datum = mockSend.mock.calls[0][0].input.MetricData[0];
    expect(datum.StatisticValues).toEqual({
      Minimum: 5,
      Maximum: 100,
      Sum: 500,
      SampleCount: 10,
    });
  });

  it('should map values data correctly', async () => {
    const metrics: CollectedMetricData[] = [
      {
        name: 'ResponseTime',
        labels: {},
        data: [{ type: 'values', values: [1, 2, 3], counts: [10, 20, 30] }],
        collectedAt: new Date('2024-01-01'),
      },
    ];

    await destination.flush(metrics);

    const datum = mockSend.mock.calls[0][0].input.MetricData[0];
    expect(datum.Values).toEqual([1, 2, 3]);
    expect(datum.Counts).toEqual([10, 20, 30]);
    expect(datum.Unit).toBe('None');
  });

  it('should use default unit None when unit not provided', async () => {
    const metrics: CollectedMetricData[] = [
      {
        name: 'NoUnit',
        labels: {},
        data: [{ type: 'sum', value: 1 }],
        collectedAt: new Date('2024-01-01'),
      },
    ];

    await destination.flush(metrics);

    const datum = mockSend.mock.calls[0][0].input.MetricData[0];
    expect(datum.Unit).toBe('None');
  });

  it('should group metrics by namespace', async () => {
    const metrics: CollectedMetricData[] = [
      {
        name: 'M1',
        labels: {},
        namespace: 'custom/ns',
        data: [{ type: 'sum', value: 1 }],
        collectedAt: new Date('2024-01-01'),
      },
      {
        name: 'M2',
        labels: {},
        data: [{ type: 'sum', value: 2 }],
        collectedAt: new Date('2024-01-01'),
      },
    ];

    await destination.flush(metrics);

    expect(mockSend).toHaveBeenCalledTimes(2);
    const namespaces = mockSend.mock.calls.map(
      (call: [{ input: { Namespace: string } }]) => call[0].input.Namespace,
    );
    expect(namespaces).toContain('custom/ns');
    expect(namespaces).toContain('test/app');
  });

  it('should retry with split on 413 error', async () => {
    const error = new Error('Request too large');
    error.name = '413';
    mockSend.mockRejectedValueOnce(error).mockResolvedValue({});

    const metrics: CollectedMetricData[] = [
      {
        name: 'M1',
        labels: {},
        data: [
          { type: 'sum', value: 1 },
          { type: 'sum', value: 2 },
        ],
        collectedAt: new Date('2024-01-01'),
      },
    ];

    await destination.flush(metrics);

    // 1 initial + 2 retries
    expect(mockSend).toHaveBeenCalledTimes(3);
  });
});
