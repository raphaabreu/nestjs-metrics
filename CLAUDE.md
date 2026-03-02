# CLAUDE.md

## Project Overview

`@raphaabreu/nestjs-metrics` — Destination-agnostic metric collection and pre-aggregation for NestJS. Metrics are defined as injectable classes, aggregated in memory, and flushed to pluggable destinations (CloudWatch, console, custom).

## Project Structure

- `src/` — All source code
  - `metric.ts` — Abstract `Metric` base class (record, flush, label-based collector management)
  - `sum-metric.ts`, `statistic-set-metric.ts`, `values-metric.ts` — Concrete metric types
  - `collectors/` — Aggregation strategies (SumCollector, StatisticSetCollector, ValuesCollector)
  - `metric-registry.ts` — Injectable factory for creating metrics inline without subclassing
  - `metric-flush.service.ts` — Discovers metrics and flushes on interval / shutdown
  - `metric-flush.interceptor.ts` — Optional per-request flush for serverless
  - `metric.module.ts` — NestJS dynamic module registration
  - `cloudwatch/` — CloudWatch destination (payload splitting, 413 retry)
  - `console/` — Console destination (NestJS Logger)
  - `composite-destination.ts` — Fan-out to multiple destinations
  - `types.ts` — Shared interfaces (MetricRecorder, MetricCollector, MetricDestination, etc.)
- `lib/` — Compiled output (gitignored)

## Commands

- `npm test` — Run all tests (Jest)
- `npm run build` — Clean and compile (`rimraf lib && tsc`)
- `npm run lint` — ESLint
- `npm run format` — Prettier

## Conventions

- Tests live next to source files as `*.spec.ts`
- CommonJS module output targeting ES2020
- Subpath exports: `@raphaabreu/nestjs-metrics`, `/cloudwatch`, `/console`

## Publishing

When asked to publish a new version:
1. Increment the **patch** version in `package.json` (e.g. 1.0.1 -> 1.0.2)
2. Run `npm run build` to rebuild
3. Run `npm test` to verify all tests pass
4. Run `npm publish --access public`
5. Commit the version bump
