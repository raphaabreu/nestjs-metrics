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
  unit = 'None';

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
  unit = 'Count';

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

That's it. Metrics are discovered automatically, aggregated in memory, and flushed to your destination on a timer.

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
  unit = 'Count';

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
  unit = 'Milliseconds';

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
  unit = 'Milliseconds';

  @OnEvent('http-request')
  onRequest(event: HttpRequestEvent) {
    this.record(event.durationMs);
  }
}
```

## Labels

Labels create separate aggregation buckets. Useful for splitting metrics by dimension:

```typescript
this.record(value, { environment: 'prod', region: 'us-east-1' });
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
| `producer.add(id, value, dimensions)` | `metric.record(value, labels)` |
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
