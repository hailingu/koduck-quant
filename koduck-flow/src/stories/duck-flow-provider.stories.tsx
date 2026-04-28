import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import type { DuckFlowTenantConfig } from "../common/runtime";
import { DuckFlowProvider } from "../components/provider/DuckFlowProvider";
import {
  useDuckFlowTenant,
  useTenantFeatureFlag,
  useTenantRollout,
} from "../components/provider/hooks/useDuckFlowRuntime";

const TenantSnapshot: React.FC = () => {
  const tenant = useDuckFlowTenant();
  const betaEnabled = useTenantFeatureFlag("beta-flow", false);
  const rollout = useTenantRollout("storybook");

  if (!tenant) {
    return <span style={{ color: "#f87171" }}>No tenant context available.</span>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        minWidth: "22rem",
        padding: "1.5rem",
        borderRadius: "0.75rem",
        background: "rgba(15, 23, 42, 0.65)",
        color: "#e2e8f0",
        border: "1px solid rgba(148, 163, 184, 0.35)",
      }}
    >
      <header
        style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.25)", paddingBottom: "0.75rem" }}
      >
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
          {tenant.displayName ?? tenant.tenantId}
        </h2>
        <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
          Environment: <strong>{tenant.environment}</strong>
        </p>
      </header>

      <section>
        <h3
          style={{
            margin: "0 0 0.4rem",
            fontSize: "1rem",
            textTransform: "uppercase",
            color: "#a5b4fc",
          }}
        >
          Feature Flags
        </h3>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.6 }}>
          <li>
            <code>beta-flow</code> → <strong>{betaEnabled ? "Enabled" : "Disabled"}</strong>
          </li>
          <li>
            <code>rollout-active</code> → <strong>{rollout ? "Targeted" : "Control"}</strong>
          </li>
        </ul>
      </section>

      {tenant.quotas ? (
        <section>
          <h3
            style={{
              margin: "0 0 0.4rem",
              fontSize: "1rem",
              textTransform: "uppercase",
              color: "#34d399",
            }}
          >
            Quotas
          </h3>
          <pre
            style={{
              margin: 0,
              fontSize: "0.85rem",
              whiteSpace: "pre-wrap",
              background: "rgba(30, 41, 59, 0.65)",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(148, 163, 184, 0.2)",
            }}
          >
            {JSON.stringify(tenant.quotas, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
};

type StoryProps = {
  tenant: DuckFlowTenantConfig;
  showDebugPanel: boolean;
};

const meta = {
  title: "Providers/DuckFlowProvider",
  component: TenantSnapshot,
  parameters: {
    docs: {
      description: {
        component:
          "DuckFlowProvider wires runtime context, tenant configuration, and optional debug tooling into the React tree.",
      },
    },
  },
  argTypes: {
    showDebugPanel: {
      control: "boolean",
      description: "Toggle the built-in debug panel",
    },
    tenant: {
      control: "object",
      description: "Tenant configuration passed into DuckFlowProvider",
    },
  },
  args: {
    showDebugPanel: false,
    tenant: {
      tenantId: "tenant-storybook",
      displayName: "Storybook Tenant",
      environment: "storybook",
      quotas: {
        maxEntities: 24,
        custom: {
          workflows: 12,
          drafts: 4,
        },
      },
      rollout: {
        percentage: 65,
        stickyKey: "storybook",
        features: {
          "beta-flow": true,
        },
      },
    },
  } satisfies StoryProps,
} satisfies Meta<typeof TenantSnapshot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TenantOverview: Story = {
  render: (args) => {
    const { tenant, showDebugPanel } = args as StoryProps;

    return (
      <DuckFlowProvider
        tenant={tenant}
        debugOptions={{
          enabled: showDebugPanel,
          panel: {
            enabled: showDebugPanel,
            defaultOpen: showDebugPanel,
          },
        }}
      >
        <TenantSnapshot />
      </DuckFlowProvider>
    );
  },
};

export const DebugPanelEnabled: Story = {
  args: {
    showDebugPanel: true,
    tenant: {
      tenantId: "tenant-debug",
      displayName: "Debug Tenant",
      environment: "storybook",
      quotas: {
        maxEntities: 12,
      },
      rollout: {
        percentage: 100,
        features: {
          "beta-flow": true,
        },
      },
    },
  },
};
