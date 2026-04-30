import { useEffect, useMemo, useRef, useState } from "react";
import type mermaid from "mermaid";

const MERMAID_DIRECTIVE_PATTERN =
  /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|xychart-beta)\b/i;

let mermaidConfigured = false;

async function configureMermaid(): Promise<typeof mermaid> {
  const mermaidModule = (await import("mermaid")).default;
  if (mermaidConfigured) {
    return mermaidModule;
  }

  mermaidModule.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      primaryColor: "#ffffff",
      primaryBorderColor: "#cbd5e1",
      primaryTextColor: "#0f172a",
      lineColor: "#64748b",
      secondaryColor: "#f8fafc",
      tertiaryColor: "#ecfdf5",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    },
  });
  mermaidConfigured = true;
  return mermaidModule;
}

export function isMermaidDiagramSource(source: string) {
  return MERMAID_DIRECTIVE_PATTERN.test(source.trim());
}

function normalizeMermaidSource(source: string) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/--\s+>/g, "-->")
    .trim();
}

export function MermaidDiagram({ source }: { source: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`koduck-mermaid-${crypto.randomUUID()}`);
  const normalizedSource = useMemo(() => normalizeMermaidSource(source), [source]);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      configureMermaid();
      setError(null);
      setSvg(null);

      try {
        const mermaidRenderer = await configureMermaid();
        await mermaidRenderer.parse(normalizedSource);
        const result = await mermaidRenderer.render(idRef.current, normalizedSource);
        if (!cancelled) {
          setSvg(result.svg);
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Mermaid render failed");
        }
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [normalizedSource]);

  if (error) {
    return (
      <code className="block overflow-x-auto rounded-xl bg-gray-100 px-4 py-3 font-mono text-sm leading-6 text-gray-900">
        {source}
      </code>
    );
  }

  return (
    <div className="mb-3 overflow-x-auto rounded-xl border border-gray-200 bg-white p-4">
      {svg ? (
        <div
          className="[&_svg]:mx-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" aria-label="正在渲染流程图" />
      )}
    </div>
  );
}
