/**
 * Prometheus Exporter tests
 * 测试Prometheus导出器的功能
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderPrometheusExposition } from "../../src/common/metrics/exporter-prometheus";
import { InMemoryMetricsProvider } from "../../src/common/metrics/in-memory";
import { configureMetrics } from "../../src/common/metrics/config";
import type { ProviderSnapshot } from "../../src/common/metrics/types";

describe("PrometheusExporter", () => {
  let provider: InMemoryMetricsProvider;

  beforeEach(() => {
    // 重置metrics配置
    configureMetrics({
      governance: {
        seriesLimitPerMetric: undefined,
        seriesTTLms: undefined,
        samplingRate: 1.0,
        labelWhitelist: undefined,
        labelBlacklist: undefined,
      },
      naming: {
        metricNamePrefix: undefined,
      },
    });

    provider = new InMemoryMetricsProvider();
  });

  describe("renderPrometheusExposition Function", () => {
    it("应该是一个函数", () => {
      expect(typeof renderPrometheusExposition).toBe("function");
    });

    it("应该支持配置前缀", () => {
      configureMetrics({
        naming: {
          metricNamePrefix: "app",
        },
      });

      const meter = provider.getMeter("test");
      const counter = meter.counter("requests");
      counter.add(42);

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain('app_requests_total{scope="test"} 42');
    });
  });

  describe("Counter Export", () => {
    it("应该正确导出简单counter", () => {
      const meter = provider.getMeter("test");
      const counter = meter.counter("requests_total", {
        description: "Total number of requests",
        unit: "count",
      });

      counter.add(10);
      counter.add(5, { method: "GET", status: "200" });

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain("# HELP requests_total counter");
      expect(prometheus).toContain("# TYPE requests_total counter");
      expect(prometheus).toContain('requests_total{scope="test"} 10');
      expect(prometheus).toContain('requests_total{method="GET",status="200",scope="test"} 5');
    });

    it("应该正确处理带前缀的counter", () => {
      configureMetrics({
        naming: {
          metricNamePrefix: "myapp",
        },
      });

      const meter = provider.getMeter("test");
      const counter = meter.counter("requests");
      counter.add(42);

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain("# TYPE myapp_requests_total counter");
      expect(prometheus).toContain('myapp_requests_total{scope="test"} 42');
    });

    it("应该按label键排序", () => {
      const meter = provider.getMeter("test");
      const counter = meter.counter("sorted_counter");

      counter.add(1, { z: "last", a: "first", m: "middle" });

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain('{a="first",m="middle",z="last",scope="test"}');
    });

    it("应该对特殊字符进行转义", () => {
      const meter = provider.getMeter("test");
      const counter = meter.counter("escapes");

      counter.add(1, { label: 'foo"bar\\baz\nqux' });

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain('escapes_total{label="foo\\"bar\\\\baz\\nqux",scope="test"} 1');
    });
  });

  describe("UpDownCounter Export", () => {
    it("应该正确导出upDownCounter", () => {
      const meter = provider.getMeter("test");
      const upDownCounter = meter.upDownCounter("active_connections", {
        description: "Active database connections",
        unit: "connections",
      });

      upDownCounter.add(5);
      upDownCounter.add(-2, { pool: "primary" });

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain("# HELP active_connections gauge");
      expect(prometheus).toContain("# TYPE active_connections gauge");
      expect(prometheus).toContain('active_connections{scope="test"} 5');
      expect(prometheus).toContain('active_connections{pool="primary",scope="test"} -2');
    });
  });

  describe("Gauge Export", () => {
    it("应该正确导出gauge", () => {
      const meter = provider.getMeter("test");
      const gauge = meter.gauge("cpu_usage", {
        description: "Current CPU usage percentage",
        unit: "percent",
      });

      gauge.set(75.5);
      gauge.set(82.3, { core: "0" });

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain("# HELP cpu_usage gauge");
      expect(prometheus).toContain("# TYPE cpu_usage gauge");
      expect(prometheus).toContain('cpu_usage{scope="test"} 75.5');
      expect(prometheus).toContain('cpu_usage{core="0",scope="test"} 82.3');
    });
  });

  describe("Histogram Export", () => {
    it("应该正确导出histogram", () => {
      const meter = provider.getMeter("test");
      const histogram = meter.histogram("request_duration", {
        description: "Request duration in milliseconds",
        unit: "ms",
        boundaries: [1, 5, 10, 25, 50, 100],
      });

      histogram.record(2);
      histogram.record(8);
      histogram.record(15);
      histogram.record(75);

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain("# HELP request_duration histogram");
      expect(prometheus).toContain("# TYPE request_duration histogram");

      // 检查累积桶 (scope在前面)
      expect(prometheus).toContain('request_duration_bucket{scope="test",le="1"} 0');
      expect(prometheus).toContain('request_duration_bucket{scope="test",le="5"} 1'); // 2 <= 5
      expect(prometheus).toContain('request_duration_bucket{scope="test",le="10"} 2'); // 2, 8 <= 10
      expect(prometheus).toContain('request_duration_bucket{scope="test",le="25"} 3'); // 2, 8, 15 <= 25
      expect(prometheus).toContain('request_duration_bucket{scope="test",le="50"} 3'); // 2, 8, 15 <= 50
      expect(prometheus).toContain('request_duration_bucket{scope="test",le="100"} 4'); // all values <= 100
      expect(prometheus).toContain('request_duration_bucket{scope="test",le="+Inf"} 4'); // all values

      // 检查总计和计数
      expect(prometheus).toContain('request_duration_sum{scope="test"} 100'); // 2+8+15+75
      expect(prometheus).toContain('request_duration_count{scope="test"} 4');
    });

    it("应该处理空的histogram", () => {
      const meter = provider.getMeter("test");
      meter.histogram("empty_histogram");

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain("# TYPE empty_histogram histogram");
      // 空的histogram不输出数据行，只有HELP和TYPE
      expect(prometheus).not.toContain("empty_histogram_count");
      expect(prometheus).not.toContain("empty_histogram_sum");
    });
  });

  describe("Multiple Meters", () => {
    it("应该正确导出多个meter的metrics", () => {
      const apiMeter = provider.getMeter("api");
      const dbMeter = provider.getMeter("database");

      // API metrics
      const requests = apiMeter.counter("requests_total");
      const connections = dbMeter.gauge("connection_pool_size");

      // 记录数据
      requests.add(100, { method: "GET" });
      connections.set(15);

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      // 验证所有metrics都存在
      expect(prometheus).toContain("requests_total");
      expect(prometheus).toContain("connection_pool_size");

      // 验证具体值
      expect(prometheus).toContain('requests_total{method="GET",scope="api"} 100');
      expect(prometheus).toContain('connection_pool_size{scope="database"} 15');
    });
  });

  describe("Edge Cases", () => {
    it("应该处理空的snapshot", () => {
      const emptySnapshot: ProviderSnapshot = { meters: [] };
      const prometheus = renderPrometheusExposition(emptySnapshot);

      expect(prometheus).toBe("");
    });

    it("应该处理没有metrics的meter", () => {
      // 创建meter但不添加任何metrics
      provider.getMeter("empty");

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toBe("");
    });

    it("应该处理特殊字符的metric名称", () => {
      const meter = provider.getMeter("test");
      const counter = meter.counter("metric_with_underscores_and_numbers_123");

      counter.add(1);

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain('metric_with_underscores_and_numbers_123_total{scope="test"} 1');
    });

    it("应该处理零值", () => {
      const meter = provider.getMeter("test");
      const counter = meter.counter("zero_counter");
      const gauge = meter.gauge("zero_gauge");

      counter.add(0);
      gauge.set(0);

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain('zero_counter_total{scope="test"} 0');
      expect(prometheus).toContain('zero_gauge{scope="test"} 0');
    });

    it("应该处理负数", () => {
      const meter = provider.getMeter("test");
      const upDownCounter = meter.upDownCounter("negative_counter");
      const gauge = meter.gauge("negative_gauge");

      upDownCounter.add(-50);
      gauge.set(-25.5);

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain('negative_counter{scope="test"} -50');
      expect(prometheus).toContain('negative_gauge{scope="test"} -25.5');
    });

    it("应该处理浮点数", () => {
      const meter = provider.getMeter("test");
      const gauge = meter.gauge("float_gauge");

      gauge.set(3.14159);

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain('float_gauge{scope="test"} 3.14159');
    });
  });

  describe("Label Handling", () => {
    it("应该处理空label值", () => {
      const meter = provider.getMeter("test");
      const counter = meter.counter("empty_label_counter");

      counter.add(1, { empty: "", normal: "value" });

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain(
        'empty_label_counter_total{empty="",normal="value",scope="test"} 1'
      );
    });

    it("应该处理数字label值", () => {
      const meter = provider.getMeter("test");
      const counter = meter.counter("numeric_label_counter");

      counter.add(1, {
        string_num: "123",
        actual_num: 456,
        boolean_val: true,
      });

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      expect(prometheus).toContain(
        'numeric_label_counter_total{actual_num="456",boolean_val="true",string_num="123",scope="test"} 1'
      );
    });
  });

  describe("Format Compliance", () => {
    it("应该生成符合Prometheus格式的输出", () => {
      const meter = provider.getMeter("test");

      const counter = meter.counter("http_requests_total", {
        description: "Total HTTP requests",
      });
      const histogram = meter.histogram("http_request_duration_seconds", {
        description: "HTTP request duration",
        boundaries: [0.1, 0.5, 1.0],
      });

      counter.add(100, { method: "GET", status: "200" });
      histogram.record(0.25, { method: "GET" });

      const snapshot = provider.snapshot();
      const prometheus = renderPrometheusExposition(snapshot);

      // 验证格式结构
      const lines = prometheus.split("\n").filter((line: string) => line.trim());

      // 应该有HELP和TYPE注释
      expect(lines.filter((line: string) => line.startsWith("# HELP"))).toHaveLength(2);
      expect(lines.filter((line: string) => line.startsWith("# TYPE"))).toHaveLength(2);

      // 每个metric应该有正确的TYPE
      expect(prometheus).toContain("# TYPE http_requests_total counter");
      expect(prometheus).toContain("# TYPE http_request_duration_seconds histogram");

      // 验证行格式
      const metricLines = lines.filter((line: string) => !line.startsWith("#"));
      for (const line of metricLines) {
        // 每个metric行应该以metric名称开始，以数值结束
        expect(line).toMatch(/^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}]*\})?\s+[\d.-]+(\s+\d+)?$/);
      }
    });
  });
});
