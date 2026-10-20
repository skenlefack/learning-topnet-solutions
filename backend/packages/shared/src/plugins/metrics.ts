// ============================================================================
// Topnet Solutions Academy — Prometheus Metrics Plugin (Fastify)
// Lightweight custom implementation — no external dependency required.
// Exposes /metrics endpoint with Prometheus-compatible text format.
// Tracks: request count, request duration, response size, active connections.
// Usage: fastify.register(metricsPlugin)
// ============================================================================
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ---------------------------------------------------------------------------
// Histogram bucket boundaries (in seconds)
// ---------------------------------------------------------------------------
const DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

const RESPONSE_SIZE_BUCKETS = [
  100, 500, 1000, 5000, 10_000, 50_000, 100_000, 500_000, 1_000_000,
];

// ---------------------------------------------------------------------------
// Internal metric storage types
// ---------------------------------------------------------------------------
interface CounterEntry {
  method: string;
  route: string;
  statusCode: string;
  count: number;
}

interface HistogramEntry {
  buckets: number[];
  sum: number;
  count: number;
}

interface MetricsStore {
  /** http_requests_total — labelled by method, route, status_code */
  requests: Map<string, CounterEntry>;
  /** http_request_duration_seconds — histogram */
  durations: Map<string, HistogramEntry>;
  /** http_response_size_bytes — histogram */
  responseSizes: Map<string, HistogramEntry>;
  /** http_active_connections — gauge */
  activeConnections: number;
  /** process_start_time_seconds */
  startTime: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeKey(method: string, route: string, statusCode: string): string {
  return `${method}|${route}|${statusCode}`;
}

function makeDurationKey(method: string, route: string): string {
  return `${method}|${route}`;
}

function getOrCreateHistogram(
  map: Map<string, HistogramEntry>,
  key: string,
  bucketBoundaries: number[],
): HistogramEntry {
  let entry = map.get(key);
  if (!entry) {
    entry = {
      buckets: new Array(bucketBoundaries.length + 1).fill(0), // +1 for +Inf
      sum: 0,
      count: 0,
    };
    map.set(key, entry);
  }
  return entry;
}

function observeHistogram(
  entry: HistogramEntry,
  value: number,
  bucketBoundaries: number[],
): void {
  entry.sum += value;
  entry.count += 1;
  for (let i = 0; i < bucketBoundaries.length; i++) {
    if (value <= bucketBoundaries[i]) {
      entry.buckets[i] += 1;
    }
  }
  // +Inf bucket always incremented
  entry.buckets[bucketBoundaries.length] += 1;
}

// ---------------------------------------------------------------------------
// Render metrics in Prometheus exposition format
// ---------------------------------------------------------------------------
function renderMetrics(store: MetricsStore, serviceName: string): string {
  const lines: string[] = [];

  // -- http_requests_total (counter) ----------------------------------------
  lines.push('# HELP http_requests_total Total number of HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const entry of store.requests.values()) {
    lines.push(
      `http_requests_total{service="${serviceName}",method="${entry.method}",route="${entry.route}",status_code="${entry.statusCode}"} ${entry.count}`,
    );
  }

  // -- http_request_duration_seconds (histogram) ----------------------------
  lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [key, entry] of store.durations.entries()) {
    const [method, route] = key.split('|');
    const labels = `service="${serviceName}",method="${method}",route="${route}"`;
    for (let i = 0; i < DURATION_BUCKETS.length; i++) {
      lines.push(
        `http_request_duration_seconds_bucket{${labels},le="${DURATION_BUCKETS[i]}"} ${entry.buckets[i]}`,
      );
    }
    lines.push(
      `http_request_duration_seconds_bucket{${labels},le="+Inf"} ${entry.buckets[DURATION_BUCKETS.length]}`,
    );
    lines.push(`http_request_duration_seconds_sum{${labels}} ${entry.sum}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${entry.count}`);
  }

  // -- http_response_size_bytes (histogram) ---------------------------------
  lines.push('# HELP http_response_size_bytes HTTP response size in bytes');
  lines.push('# TYPE http_response_size_bytes histogram');
  for (const [key, entry] of store.responseSizes.entries()) {
    const [method, route] = key.split('|');
    const labels = `service="${serviceName}",method="${method}",route="${route}"`;
    for (let i = 0; i < RESPONSE_SIZE_BUCKETS.length; i++) {
      lines.push(
        `http_response_size_bytes_bucket{${labels},le="${RESPONSE_SIZE_BUCKETS[i]}"} ${entry.buckets[i]}`,
      );
    }
    lines.push(
      `http_response_size_bytes_bucket{${labels},le="+Inf"} ${entry.buckets[RESPONSE_SIZE_BUCKETS.length]}`,
    );
    lines.push(`http_response_size_bytes_sum{${labels}} ${entry.sum}`);
    lines.push(`http_response_size_bytes_count{${labels}} ${entry.count}`);
  }

  // -- http_active_connections (gauge) --------------------------------------
  lines.push('# HELP http_active_connections Number of currently active HTTP connections');
  lines.push('# TYPE http_active_connections gauge');
  lines.push(`http_active_connections{service="${serviceName}"} ${store.activeConnections}`);

  // -- process_start_time_seconds (gauge) -----------------------------------
  lines.push('# HELP process_start_time_seconds Start time of the process since unix epoch in seconds');
  lines.push('# TYPE process_start_time_seconds gauge');
  lines.push(`process_start_time_seconds{service="${serviceName}"} ${store.startTime}`);

  // -- nodejs_process_memory (gauge) ----------------------------------------
  const mem = process.memoryUsage();
  lines.push('# HELP nodejs_heap_used_bytes Process heap size used in bytes');
  lines.push('# TYPE nodejs_heap_used_bytes gauge');
  lines.push(`nodejs_heap_used_bytes{service="${serviceName}"} ${mem.heapUsed}`);
  lines.push('# HELP nodejs_heap_total_bytes Process heap size total in bytes');
  lines.push('# TYPE nodejs_heap_total_bytes gauge');
  lines.push(`nodejs_heap_total_bytes{service="${serviceName}"} ${mem.heapTotal}`);
  lines.push('# HELP nodejs_rss_bytes Process RSS in bytes');
  lines.push('# TYPE nodejs_rss_bytes gauge');
  lines.push(`nodejs_rss_bytes{service="${serviceName}"} ${mem.rss}`);
  lines.push('# HELP nodejs_external_bytes Process external memory in bytes');
  lines.push('# TYPE nodejs_external_bytes gauge');
  lines.push(`nodejs_external_bytes{service="${serviceName}"} ${mem.external}`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Plugin implementation
// ---------------------------------------------------------------------------
async function metricsPlugin(fastify: FastifyInstance): Promise<void> {
  const serviceName = process.env.SERVICE_NAME || 'unknown';
  const enabled = process.env.METRICS_ENABLED !== 'false';

  if (!enabled) {
    // Register a minimal /metrics endpoint even when disabled
    fastify.get('/metrics', async (_req, reply) => {
      reply.type('text/plain; version=0.0.4; charset=utf-8');
      return '# Metrics collection disabled\n';
    });
    return;
  }

  const store: MetricsStore = {
    requests: new Map(),
    durations: new Map(),
    responseSizes: new Map(),
    activeConnections: 0,
    startTime: Math.floor(Date.now() / 1000),
  };

  // -- Track active connections ---------------------------------------------
  fastify.addHook('onRequest', async () => {
    store.activeConnections += 1;
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    store.activeConnections = Math.max(0, store.activeConnections - 1);

    // Skip metrics endpoint itself to avoid noise
    if (request.url === '/metrics') return;

    const method = request.method;
    // Use routeOptions (Fastify v4+) or fallback to raw url
    const route =
      (request.routeOptions && request.routeOptions.url) ||
      request.url.split('?')[0] ||
      'unknown';
    const statusCode = String(reply.statusCode);

    // --- Counter: requests total ---
    const counterKey = makeKey(method, route, statusCode);
    const existing = store.requests.get(counterKey);
    if (existing) {
      existing.count += 1;
    } else {
      store.requests.set(counterKey, { method, route, statusCode, count: 1 });
    }

    // --- Histogram: request duration ---
    const elapsedMs = reply.elapsedTime; // Fastify built-in (ms)
    if (typeof elapsedMs === 'number') {
      const elapsedSec = elapsedMs / 1000;
      const durationKey = makeDurationKey(method, route);
      const durationEntry = getOrCreateHistogram(store.durations, durationKey, DURATION_BUCKETS);
      observeHistogram(durationEntry, elapsedSec, DURATION_BUCKETS);
    }

    // --- Histogram: response size ---
    const contentLength = reply.getHeader('content-length');
    if (contentLength) {
      const bytes = parseInt(String(contentLength), 10);
      if (!isNaN(bytes)) {
        const sizeKey = makeDurationKey(method, route);
        const sizeEntry = getOrCreateHistogram(
          store.responseSizes,
          sizeKey,
          RESPONSE_SIZE_BUCKETS,
        );
        observeHistogram(sizeEntry, bytes, RESPONSE_SIZE_BUCKETS);
      }
    }
  });

  // -- /metrics endpoint (Prometheus scrape target) -------------------------
  fastify.get('/metrics', async (_request, reply) => {
    reply.type('text/plain; version=0.0.4; charset=utf-8');
    return renderMetrics(store, serviceName);
  });
}

export default fp(metricsPlugin, {
  name: 'academy-metrics',
  // No dependencies — register this before routes but it works standalone
});
