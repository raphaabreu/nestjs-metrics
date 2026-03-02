# @raphaabreu/nestjs-metrics

Destination-agnostic metric collection and pre-aggregation for NestJS. Define injectable metric classes that listen to application events and automatically aggregate data, then flush to any destination (CloudWatch, console, or your own).

## Installation

```bash
npm i @raphaabreu/nestjs-metrics
```

For CloudWatch support:

```bash
npm i @raphaabreu/nestjs-metrics @aws-sdk/client-cloudwatch
```

## Quick Start

### 1. Define a metric with an event listener

Each metric is an `@Injectable()` class that subscribes to application events and records values internally. This keeps metric logic self-contained — the services that produce events don't need to know about metrics at all.

You can use any event mechanism. Here are two common approaches:

#### Using `@nestjs/event-emitter`

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StatisticSetMetric } from '@raphaabreu/nestjs-metrics';

@Injectable()
export class OrderValueMetric extends StatisticSetMetric {
  name = 'OrderValue';

  @OnEvent('order-placed')
  onOrderPlaced(event: OrderPlacedEvent) {
    this.record(event.total, { country: event.country });
  }
}
```

The producing side simply emits events as usual:

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async placeOrder(order: Order) {
    // ... business logic ...
    this.eventEmitter.emit('order-placed', { total: order.amount, country: order.country });
  }
}
```

#### Using `@nestjs/cqrs` EventBus

```typescript
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { SumMetric } from '@raphaabreu/nestjs-metrics';

@Injectable()
@EventsHandler(OrderPlacedEvent)
export class RequestCountMetric extends SumMetric implements IEventHandler<OrderPlacedEvent> {
  name = 'RequestCount';

  handle(event: OrderPlacedEvent) {
    this.record(1, { country: event.country });
  }
}
```

The producing side publishes events through the EventBus as usual:

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly eventBus: EventBus) {}

  async placeOrder(order: Order) {
    // ... business logic ...
    this.eventBus.publish(new OrderPlacedEvent(order.amount, order.country));
  }
}
```

In both cases the metric class owns the subscription, the value extraction, and the label mapping. The producers don't reference metrics at all.

### 2. Register the module

```typescript
import { Module } from '@nestjs/common';
import { MetricModule } from '@raphaabreu/nestjs-metrics';
import { CloudWatchDestination } from '@raphaabreu/nestjs-metrics/cloudwatch';

@Module({
  imports: [
    MetricModule.register({
      destination: new CloudWatchDestination({ namespace: 'mycompany/myapp' }),
      flushIntervalMs: 55000, // default
    }),
  ],
  providers: [OrderValueMetric, RequestCountMetric],
})
export class AppModule {}
```

That's it. Metrics are discovered automatically, aggregated in memory, and flushed to your destination on a timer. The service also registers `SIGTERM` and `SIGINT` handlers to ensure a final flush on graceful shutdown.

## Flush on Request (Lambda / Serverless)

In serverless environments like AWS Lambda, the runtime may freeze the process between invocations. Any metrics accumulated during a request could be lost if they haven't been flushed before the response is sent. Enable `flushOnRequest` to flush all collected metrics after every HTTP request:

```typescript
MetricModule.register({
  destination: new CloudWatchDestination({ namespace: 'mycompany/myapp' }),
  flushOnRequest: true,
})
```

This registers a global interceptor that calls `flush()` after each request completes, before the response is returned. The periodic timer still runs as a safety net, but the per-request flush ensures no data is lost to Lambda freezes.

For long-running servers where the timer alone is sufficient, leave `flushOnRequest` off (the default).

## MetricRegistry (zero-boilerplate)

When you have many metrics in a single handler, defining a class per metric can be verbose. `MetricRegistry` is an injectable factory that creates metrics inline — no subclassing needed:

```typescript
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { MetricRegistry } from '@raphaabreu/nestjs-metrics';

@EventsHandler(TaskCompletedEvent)
export class TaskMetricsRecorder implements IEventHandler<TaskCompletedEvent> {
  private readonly itemsProcessed = this.metrics.sum('ItemsProcessed');
  private readonly processingTime = this.metrics.statisticSet('ProcessingTime');
  private readonly taskSuccess = this.metrics.sum('TaskSuccess');
  private readonly taskFailure = this.metrics.sum('TaskFailure');
  private readonly payloadSize = this.metrics.statisticSet('PayloadSize');

  constructor(private readonly metrics: MetricRegistry) {}

  handle(event: TaskCompletedEvent): void {
    const labels = { queue: event.queue };

    this.itemsProcessed.record(event.itemCount, labels);
    this.processingTime.record(event.durationMs, labels);
    this.taskSuccess.record(event.status === 'completed' ? 1 : 0, labels);
    this.taskFailure.record(event.status === 'failed' ? 1 : 0, labels);

    if (event.payloadBytes !== undefined) {
      this.payloadSize.record(event.payloadBytes, labels);
    }
  }
}
```

Register the `MetricRegistry` as a provider alongside the handler:

```typescript
providers: [MetricRegistry, RunMetricsRecorder],
```

The registry is automatically discovered by `MetricFlushService` — its metrics are flushed alongside standalone metric classes.

Available factory methods: `sum()`, `statisticSet()`, `values()`. Each accepts an optional second argument for [metric options](#metric-options).

## Direct Recording

While the event-listener pattern above is the recommended approach, you can also inject a metric and record values directly when that makes more sense for your use case:

```typescript
@Injectable()
export class PaymentService {
  constructor(private readonly orderValue: OrderValueMetric) {}

  async processPayment(order: Order) {
    this.orderValue.record(order.amount, { country: order.country });
  }
}
```

## Metric Types

### SumMetric

Aggregates values into a single sum. Minimal payload, ideal for counters.

```typescript
@Injectable()
export class ErrorCountMetric extends SumMetric {
  name = 'ErrorCount';

  @OnEvent('error')
  onError(event: ErrorEvent) {
    this.record(1, { service: event.service });
  }
}
```

### StatisticSetMetric

Tracks min, max, sum, and count. Good for averages without full distributions.

```typescript
@Injectable()
export class LatencyMetric extends StatisticSetMetric {
  name = 'Latency';

  @OnEvent('http-request')
  onRequest(event: HttpRequestEvent) {
    this.record(event.durationMs, { route: event.route });
  }
}
```

### ValuesMetric

Tracks distinct values with counts. Enables percentile and distribution analysis.

```typescript
@Injectable()
export class ResponseTimeMetric extends ValuesMetric {
  name = 'ResponseTime';

  @OnEvent('http-request')
  onRequest(event: HttpRequestEvent) {
    this.record(event.durationMs);
  }
}
```

## Metric Options

Both metric classes and `MetricRegistry` factory methods accept optional `unit` and `namespace` metadata:

```typescript
// On a metric class
@Injectable()
export class LatencyMetric extends StatisticSetMetric {
  name = 'Latency';
  unit = 'Milliseconds';          // optional — passed to destination as metadata
  namespace = 'mycompany/api';    // optional — overrides the destination default
}

// With MetricRegistry
const latency = this.metrics.statisticSet('Latency', {
  unit: 'Milliseconds',
  namespace: 'mycompany/api',
});
```

- **`unit`** — Destination-specific metadata. CloudWatch maps it to [StandardUnit](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_MetricDatum.html) (defaults to `'None'`). Other destinations may ignore it.
- **`namespace`** — Overrides the destination-level namespace for this metric. CloudWatch uses it to group metrics into separate namespaces within the same destination.

## Labels

Labels create separate aggregation buckets. Useful for splitting metrics by dimension.

### No labels

Record a value without any dimensional breakdown:

```typescript
this.record(1);
```

### Single label set

Record a value with one set of dimensions:

```typescript
this.record(value, { environment: 'prod', region: 'us-east-1' });
```

### Multiple label sets

Record the same value to several dimension groupings at once by passing an array. This is common when you want a single event to contribute to an overall aggregate and to per-dimension breakdowns simultaneously:

```typescript
@Injectable()
export class OrderCountMetric extends SumMetric {
  name = 'OrderCount';

  @OnEvent('order-placed')
  onOrderPlaced(event: OrderPlacedEvent) {
    this.record(1, [
      {},                                                        // overall count
      { country: event.country },                                // per country
      { paymentMethod: event.paymentMethod },                    // per payment method
      { country: event.country, category: event.category },     // per country+category
    ]);
  }
}
```

This is equivalent to calling `record` four times with the same value but different labels, but expressed as a single call.

The same works with `MetricRegistry`:

```typescript
const orders = this.metrics.sum('OrderCount');

orders.record(1, [
  {},
  { country: 'US' },
]);
```

Labels with the same keys in any order are treated as identical.

## Destinations

### CloudWatchDestination

```typescript
import { CloudWatchDestination } from '@raphaabreu/nestjs-metrics/cloudwatch';

new CloudWatchDestination({
  namespace: 'mycompany/myapp',
  client: new CloudWatchClient({ region: 'us-east-1' }), // optional
});
```

Handles payload splitting (~100KB chunks) and 413 retry with binary split automatically.

### ConsoleDestination

```typescript
import { ConsoleDestination } from '@raphaabreu/nestjs-metrics/console';

new ConsoleDestination();
```

Logs metric data using NestJS Logger. Useful for development and debugging.

### CompositeDestination

Fan-out to multiple destinations:

```typescript
import { CompositeDestination } from '@raphaabreu/nestjs-metrics';

new CompositeDestination([
  new CloudWatchDestination({ namespace: 'myapp' }),
  new ConsoleDestination(),
]);
```

### Custom Destinations

Implement the `MetricDestination` interface:

```typescript
import { MetricDestination, CollectedMetricData } from '@raphaabreu/nestjs-metrics';

export class MyDestination implements MetricDestination {
  async flush(metrics: CollectedMetricData[]): Promise<void> {
    // Send metrics to your backend
  }
}
```

## Migration from v1

| v1 (`nestjs-auto-cloudwatch-metric-producer`) | v2 (`nestjs-metrics`) |
|---|---|
| `CloudWatchMetricModule.register()` | `MetricModule.register({ destination: new CloudWatchDestination({...}) })` |
| `AutoCloudWatchMetricProducer.register()` | Define an `@Injectable()` metric class with event listeners |
| `collectionMode: 'sum'` | `extends SumMetric` |
| `collectionMode: 'statisticSet'` | `extends StatisticSetMetric` |
| `collectionMode: 'distinctValues'` | `extends ValuesMetric` |
| `producer.add(id, value, dimensions)` | `metric.record(value, labels)` — labels can be a single object or an array of objects |
| `@nestjs/event-emitter` required | Optional — use any event/listener pattern |
| `@raphaabreu/nestjs-opensearch-structured-logger` required | Not required — uses NestJS Logger |

## Tests

```bash
npm test
```

## License

MIT License

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
