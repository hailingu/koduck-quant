import type { Meta, StoryObj } from "@storybook/react";
import React, { useCallback, useMemo, useState } from "react";
import { VirtualList } from "../components/VirtualList";

type VirtualTelemetryItem = {
  readonly id: string;
  readonly label: string;
  readonly severity: "info" | "warn" | "error";
  readonly durationMs: number;
};

type DatasetPresetKey = keyof typeof DATASET_PRESETS;

type StoryProps = {
  preset: DatasetPresetKey;
  containerHeight: number;
  bufferSize: number;
};

const DATASET_PRESETS = {
  sample: 2000,
  production: 25000,
  stress: 100000,
} as const;

const severityPalette: Record<VirtualTelemetryItem["severity"], string> = {
  info: "#2563eb",
  warn: "#d97706",
  error: "#dc2626",
};

function createVirtualTelemetry(size: number): VirtualTelemetryItem[] {
  const items: VirtualTelemetryItem[] = new Array(size);
  for (let i = 0; i < size; i += 1) {
    const severityRoll = i % 17;
    let severity: VirtualTelemetryItem["severity"] = "info";
    if (severityRoll === 0) {
      severity = "error";
    } else if (severityRoll % 5 === 0) {
      severity = "warn";
    }

    items[i] = {
      id: `evt-${i.toString(36)}`,
      label: `Workflow #${(i % 500) + 1} — Batch ${(i / 500).toFixed(0)}`,
      severity,
      durationMs: 24 + ((i * 19) % 64),
    } satisfies VirtualTelemetryItem;
  }
  return items;
}

const VirtualListPreview: React.FC<StoryProps> = ({ preset, containerHeight, bufferSize }) => {
  const itemCount = DATASET_PRESETS[preset];
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  const items = useMemo(() => createVirtualTelemetry(itemCount), [itemCount]);

  const telemetryStats = useMemo(() => {
    let info = 0;
    let warn = 0;
    let error = 0;
    for (const item of items) {
      if (item.severity === "error") {
        error += 1;
      } else if (item.severity === "warn") {
        warn += 1;
      } else {
        info += 1;
      }
    }
    return { info, warn, error };
  }, [items]);

  const handleScroll = useCallback((range: { start: number; end: number }) => {
    setVisibleRange(range);
  }, []);

  const telemetryItemHeight = useCallback((item: VirtualTelemetryItem, index: number) => {
    let severityWeight = 8;
    if (item.severity === "error") {
      severityWeight = 32;
    } else if (item.severity === "warn") {
      severityWeight = 16;
    }
    return 48 + severityWeight + (index % 7) * 4;
  }, []);

  const renderTelemetryRow = useCallback((item: VirtualTelemetryItem, index: number) => {
    const color = severityPalette[item.severity];
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          padding: "8px 12px",
          width: "100%",
          background: index % 2 === 0 ? "rgba(241, 245, 249, 0.55)" : "rgba(248, 250, 252, 0.35)",
          borderLeft: `4px solid ${color}`,
          borderRadius: "4px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "#0f172a" }}>{item.label}</span>
          <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color }}>{item.id}</span>
        </div>
        <div style={{ display: "flex", gap: "12px", fontSize: "0.85rem", color: "#475569" }}>
          <span>
            Severity: <strong style={{ color }}>{item.severity.toUpperCase()}</strong>
          </span>
          <span>Latency: {item.durationMs} ms</span>
          <span>Index: {index}</span>
        </div>
      </div>
    );
  }, []);

  const visibleCount = Math.max(0, visibleRange.end - visibleRange.start + 1);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "min(720px, 100%)",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>
          {itemCount.toLocaleString()} 条遥测事件
        </h2>
        <p style={{ margin: 0, color: "#475569", fontSize: "0.85rem" }}>
          自适应高度 + bufferSize={bufferSize}，容器高度 {containerHeight}px。
        </p>
      </header>

      <section
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          fontSize: "0.85rem",
          color: "#334155",
        }}
      >
        <span>
          可见区间：<strong>{visibleRange.start.toLocaleString()}</strong>
          <span style={{ margin: "0 4px" }}>-</span>
          <strong>{visibleRange.end.toLocaleString()}</strong>
        </span>
        <span>
          当前渲染：<strong>{visibleCount.toLocaleString()}</strong> 条
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "999px",
            background: "#eff6ff",
            color: "#1d4ed8",
          }}
        >
          Info：{telemetryStats.info.toLocaleString()}
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "999px",
            background: "#fef3c7",
            color: "#b45309",
          }}
        >
          Warn：{telemetryStats.warn.toLocaleString()}
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "999px",
            background: "#fee2e2",
            color: "#b91c1c",
          }}
        >
          Error：{telemetryStats.error.toLocaleString()}
        </span>
      </section>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          background: "#f8fafc",
          padding: "12px",
        }}
      >
        <VirtualList
          items={items}
          itemHeight={telemetryItemHeight}
          containerHeight={containerHeight}
          renderItem={renderTelemetryRow}
          onScroll={handleScroll}
          bufferSize={bufferSize}
          getItemKey={(item) => item.id}
        />
      </div>
    </div>
  );
};

const meta = {
  title: "Components/VirtualList",
  component: VirtualListPreview,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "VirtualList 通过高度缓存与 bufferSize 预取保障 100K+ 列表的滚动性能，本故事提供不同数据规模下的实时可见区反馈。",
      },
    },
  },
  argTypes: {
    preset: {
      options: Object.keys(DATASET_PRESETS),
      control: { type: "radio" },
      description: "预设数据规模",
    },
    containerHeight: {
      control: { type: "number", min: 240, max: 640, step: 20 },
      description: "虚拟列表容器高度（px）",
    },
    bufferSize: {
      control: { type: "number", min: 0, max: 24, step: 1 },
      description: "额外预加载的项数",
    },
  },
  args: {
    preset: "production",
    containerHeight: 400,
    bufferSize: 8,
  } satisfies StoryProps,
} satisfies Meta<typeof VirtualListPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ProductionScale: Story = {
  name: "生产规模（25K）",
};

export const SampleDataset: Story = {
  name: "示例规模（2K）",
  args: {
    preset: "sample",
  },
};

export const StressDataset: Story = {
  name: "压力规模（100K）",
  args: {
    preset: "stress",
    bufferSize: 12,
  },
};
