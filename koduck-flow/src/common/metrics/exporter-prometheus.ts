/**
 * @module src/common/metrics/exporter-prometheus
 * @description Prometheus metrics exporter
 * Renders metrics snapshots in Prometheus text exposition format (OpenMetrics)
 * Used to export metrics to Prometheus scrape endpoints
 * @example
 * ```typescript
 * import { renderPrometheusExposition } from '@/common/metrics';
 *
 * const snapshot = provider.snapshot();
 * const metricsText = renderPrometheusExposition(snapshot);
 * // Returns Prometheus format: # HELP metric_name ...\n metric_name{labels} value
 * ```
 */

import type { MeterSnapshot, ProviderSnapshot } from "./types";
import { getMetricsConfig } from "./config";

/**
 * Escape special characters for Prometheus label values
 * Handles backslash, newline, and quote characters
 * @param {string} s - String to escape
 * @returns {string} Escaped string safe for Prometheus labels
 * @internal
 */
function esc(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", String.raw`\n`)
    .replaceAll('"', String.raw`\"`);
}

/**
 * Convert attributes object to Prometheus label string format
 * Formats as {key1="value1",key2="value2"}
 * @param {Object.<string, string | number | boolean>} [labels] - Attributes to format
 * @returns {string} Prometheus-formatted label string (empty string if no labels)
 * @internal
 */
function labelsToString(labels: Record<string, string | number | boolean> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) return "";
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${esc(String(v))}"`);
  return `{${parts.join(",")}}`;
}

/**
 * Parse canonical attribute key back into attributes object
 * Reverses the canonicalization: 'k1=v1|k2=v2' => { k1: 'v1', k2: 'v2' }
 * @param {string} attrKey - Canonical key to parse
 * @returns {Object.<string, string>} Parsed attributes object
 * @internal
 */
function parseAttrKey(attrKey: string): Record<string, string> {
  if (!attrKey) return {};
  const obj: Record<string, string> = {};
  for (const pair of attrKey.split("|")) {
    const idx = pair.indexOf("=");
    if (idx > -1) obj[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  return obj;
}

/**
 * Render counter metric in Prometheus format
 * Format: # HELP name description\n# TYPE name counter\nname{labels} value\n
 * @param {string} name - Metric name
 * @param {string} scope - Scope/component name
 * @param {Object} data - Meter snapshot counter data
 * @returns {string} Prometheus formatted output for this counter
 * @internal
 */
function renderCounter(
  name: string,
  scope: string,
  data: MeterSnapshot["counters"][number]
): string {
  const { metricNamePrefix } = getMetricsConfig().naming ?? {};
  const metricName = name.endsWith("_total") ? name : `${name}_total`;
  const base = metricNamePrefix ? `${metricNamePrefix}_${metricName}` : metricName;
  let out = `# HELP ${base} counter\n`;
  out += `# TYPE ${base} counter\n`;
  for (const [attrKey, point] of Object.entries(data.points)) {
    const baseLabels = parseAttrKey(attrKey);
    const merged = labelsToString({ ...baseLabels, scope });
    out += `${base}${merged} ${point.value}\n`;
  }
  return out;
}

/**
 * Render gauge metric in Prometheus format
 * @param {string} name - Metric name
 * @param {string} scope - Scope/component name
 * @param {Object} data - Meter snapshot gauge data
 * @returns {string} Prometheus formatted output for this gauge
 * @internal
 */
function renderGauge(name: string, scope: string, data: MeterSnapshot["gauges"][number]): string {
  const { metricNamePrefix } = getMetricsConfig().naming ?? {};
  const base = metricNamePrefix ? `${metricNamePrefix}_${name}` : name;
  let out = `# HELP ${base} gauge\n`;
  out += `# TYPE ${base} gauge\n`;
  for (const [attrKey, point] of Object.entries(data.points)) {
    const baseLabels = parseAttrKey(attrKey);
    const merged = labelsToString({ ...baseLabels, scope });
    out += `${base}${merged} ${point.value}\n`;
  }
  return out;
}

/**
 * Render histogram metric in Prometheus format
 * Outputs bucket series with cumulative counts, plus count and sum
 * Format uses 'le' label for bucket bounds and '+Inf' for infinity bucket
 * @param {string} name - Metric name
 * @param {string} scope - Scope/component name
 * @param {Object} data - Meter snapshot histogram data
 * @returns {string} Prometheus formatted output for this histogram
 * @internal
 */
function renderHistogram(
  name: string,
  scope: string,
  data: MeterSnapshot["histograms"][number]
): string {
  const { metricNamePrefix } = getMetricsConfig().naming ?? {};
  const base = metricNamePrefix ? `${metricNamePrefix}_${name}` : name;
  let out = `# HELP ${base} histogram\n`;
  out += `# TYPE ${base} histogram\n`;
  for (const [attrKey, point] of Object.entries(data.points)) {
    const labelsObj = parseAttrKey(attrKey);
    // buckets: cumulative, includes +Inf as last
    for (let i = 0; i < point.buckets.length; i++) {
      const le = i < point.boundaries.length ? point.boundaries[i] : "+Inf";
      const labels = labelsToString({ ...labelsObj, scope, le });
      out += `${base}_bucket${labels} ${point.buckets[i]}\n`;
    }
    const lblsNoLe = labelsToString({ ...labelsObj, scope });
    out += `${base}_count${lblsNoLe} ${point.count}\n`;
    out += `${base}_sum${lblsNoLe} ${point.sum}\n`;
  }
  return out;
}

/**
 * Render a complete metrics snapshot in Prometheus text exposition format
 * Outputs all meters and their metrics (counters, gauges, histograms, up/down counters)
 * Suitable for Prometheus scrape endpoints or pushing to Prometheus PushGateway
 * @param {ProviderSnapshot} snapshot - Complete snapshot from metrics provider
 * @returns {string} Prometheus-format metrics text with all series
 * @example
 * ```typescript
 * const snapshot = provider.snapshot();
 * const prometheusText = renderPrometheusExposition(snapshot);
 * response.send(prometheusText);
 * ```
 */
export function renderPrometheusExposition(snapshot: ProviderSnapshot): string {
  let out = "";
  for (const meter of snapshot.meters) {
    for (const c of meter.counters) out += renderCounter(c.name, meter.scope, c);
    // UpDownCounter rendered as gauge in Prometheus (no _total suffix)
    for (const u of meter.upDownCounters) {
      out += renderGauge(u.name, meter.scope, {
        name: u.name,
        description: u.description,
        unit: u.unit,
        points: u.points as Record<string, { value: number }>,
      });
    }
    for (const g of meter.gauges) out += renderGauge(g.name, meter.scope, g);
    for (const h of meter.histograms) out += renderHistogram(h.name, meter.scope, h);
  }
  return out;
}
