import { MetricRegistry } from './metric-registry';

describe('MetricRegistry', () => {
  let registry: MetricRegistry;

  beforeEach(() => {
    registry = new MetricRegistry();
  });

  it('should create a sum metric and record values', () => {
    const counter = registry.sum('RequestCount');
    counter.record(1);
    counter.record(1);

    const result = registry.flush();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('RequestCount');
    expect(result[0].data).toEqual([{ type: 'sum', value: 2 }]);
  });

  it('should create a statisticSet metric and record values', () => {
    const latency = registry.statisticSet('Latency');
    latency.record(10);
    latency.record(50);
    latency.record(30);

    const result = registry.flush();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Latency');
    expect(result[0].data).toEqual([
      { type: 'statisticSet', min: 10, max: 50, sum: 90, count: 3 },
    ]);
  });

  it('should create a values metric and record values', () => {
    const rt = registry.values('ResponseTime');
    rt.record(100);
    rt.record(100);
    rt.record(200);

    const result = registry.flush();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ResponseTime');
    expect(result[0].data[0].type).toBe('values');
  });

  it('should support labels', () => {
    const counter = registry.sum('Errors');
    counter.record(1, { service: 'auth' });
    counter.record(3, { service: 'payments' });

    const result = registry.flush();
    expect(result).toHaveLength(2);
    const auth = result.find((r) => r.labels.service === 'auth');
    const payments = result.find((r) => r.labels.service === 'payments');
    expect(auth!.data).toEqual([{ type: 'sum', value: 1 }]);
    expect(payments!.data).toEqual([{ type: 'sum', value: 3 }]);
  });

  it('should pass unit from options', () => {
    const counter = registry.sum('RequestCount', { unit: 'Count' });
    counter.record(5);

    const result = registry.flush();
    expect(result[0].unit).toBe('Count');
  });

  it('should not include unit when not provided', () => {
    const counter = registry.sum('RequestCount');
    counter.record(5);

    const result = registry.flush();
    expect(result[0].unit).toBeUndefined();
  });

  it('should pass namespace from options', () => {
    const counter = registry.sum('RequestCount', { namespace: 'custom/ns' });
    counter.record(5);

    const result = registry.flush();
    expect(result[0].namespace).toBe('custom/ns');
  });

  it('should flush multiple metrics together', () => {
    const counter = registry.sum('Count');
    const latency = registry.statisticSet('Latency');

    counter.record(1);
    latency.record(100);

    const result = registry.flush();
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name).sort()).toEqual(['Count', 'Latency']);
  });

  it('should reset after flush', () => {
    const counter = registry.sum('Count');
    counter.record(42);

    registry.flush();
    expect(registry.flush()).toEqual([]);
  });

  it('should support recording array of values', () => {
    const counter = registry.sum('Count');
    counter.record([1, 2, 3]);

    const result = registry.flush();
    expect(result[0].data).toEqual([{ type: 'sum', value: 6 }]);
  });
});
