import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isMermaidDiagramSource, MermaidDiagram } from "./MermaidDiagram";
import { buildConversationFlowStateStorageKey } from "./storage";
import { normalizeMarkdownContent } from "./markdown-utils";
import {
  ConversationKoduckFlowCanvas,
  extractConversationFlowSpecFromContent,
  getConversationFlowSpecSignature,
  isConversationFlowCodeBlock,
  parseConversationFlowSpec,
} from "./ConversationFlow";
import type { ConversationFlowSpec, ConversationFlowStep } from "./types";

export function MarkdownMessage({
  content,
  messageId,
  sessionId,
  onMemoryEntryDeleted,
  availableMemoryEntryIds,
  allowImplicitFlow = false,
}: {
  content: string;
  messageId: string;
  sessionId: string | null;
  onMemoryEntryDeleted?: (entryId: string | null, step: ConversationFlowStep) => void | Promise<void>;
  availableMemoryEntryIds?: ReadonlySet<string>;
  allowImplicitFlow?: boolean;
}) {
  const parsedFlowSpec = extractConversationFlowSpecFromContent(content, {
    allowImplicit: allowImplicitFlow,
  });
  const flowSpec = parsedFlowSpec
    ? filterConversationFlowSpecByMemoryEntries(parsedFlowSpec, availableMemoryEntryIds)
    : null;
  const buildFlowStorageKey = (spec: ConversationFlowSpec) =>
    buildConversationFlowStateStorageKey(
      sessionId,
      messageId,
      getConversationFlowSpecSignature(spec),
    );

  if (flowSpec) {
    return (
      <ConversationKoduckFlowCanvas
        spec={flowSpec}
        sessionId={sessionId}
        storageKey={buildFlowStorageKey(flowSpec)}
        onMemoryEntryDeleted={onMemoryEntryDeleted}
      />
    );
  }

  return (
    <div className="max-w-none break-words text-base leading-8 text-gray-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-2xl font-semibold text-gray-900 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-4 text-xl font-semibold text-gray-900 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-lg font-semibold text-gray-900 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-3 whitespace-pre-wrap last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal pl-6">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-gray-300 pl-4 text-gray-600">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#0d8b6d] underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const codeContent = String(children).replace(/\n$/, "");
            const language = /\blanguage-([^\s]+)/i.exec(className ?? "")?.[1]?.toLowerCase();
            const isBlock = Boolean(className) || codeContent.includes("\n");
            if (isBlock) {
              if (
                language === "mermaid" ||
                language === "flowchart" ||
                isMermaidDiagramSource(codeContent)
              ) {
                return <MermaidDiagram source={codeContent} />;
              }

              const flowSpec = isConversationFlowCodeBlock(className) || allowImplicitFlow
                ? parseConversationFlowSpec(codeContent)
                : null;
              const visibleFlowSpec = flowSpec
                ? filterConversationFlowSpecByMemoryEntries(flowSpec, availableMemoryEntryIds)
                : null;
              if (visibleFlowSpec) {
                return (
                  <ConversationKoduckFlowCanvas
                    spec={visibleFlowSpec}
                    sessionId={sessionId}
                    storageKey={buildFlowStorageKey(visibleFlowSpec)}
                    onMemoryEntryDeleted={onMemoryEntryDeleted}
                  />
                );
              }

              return (
                <code className="block overflow-x-auto rounded-xl bg-gray-100 px-4 py-3 font-mono text-sm leading-6 text-gray-900">
                  {codeContent}
                </code>
              );
            }
            return (
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-900">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2 align-top">{children}</td>
          ),
          hr: () => <hr className="my-4 border-gray-200" />,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        }}
      >
        {normalizeMarkdownContent(content)}
      </ReactMarkdown>
    </div>
  );
}

function filterConversationFlowSpecByMemoryEntries(
  spec: ConversationFlowSpec,
  availableMemoryEntryIds: ReadonlySet<string> | undefined,
): ConversationFlowSpec | null {
  if (!availableMemoryEntryIds || availableMemoryEntryIds.size === 0) {
    return spec;
  }

  const visibleSteps = spec.steps.filter((step) => {
    const entryId = extractMemoryEntryIdFromFlowStep(step);
    return !entryId || availableMemoryEntryIds.has(entryId);
  });
  if (visibleSteps.length === 0) {
    return null;
  }

  const visibleStepIds = new Set(visibleSteps.map((step) => step.id));
  return {
    ...spec,
    steps: visibleSteps.map((step) => ({
      ...step,
      dependsOn: step.dependsOn.filter((dependencyId) => visibleStepIds.has(dependencyId)),
    })),
  };
}

function extractMemoryEntryIdFromFlowStep(step: ConversationFlowStep): string | null {
  const entryInput = step.input.find((item) => item.startsWith("entry_id="));
  const entryId = entryInput?.slice("entry_id=".length).trim();
  if (entryId) {
    return entryId;
  }

  const idMatch = /^entry_([0-9a-f]{8})_([0-9a-f]{4})_([0-9a-f]{4})_([0-9a-f]{4})_([0-9a-f]{12})$/i.exec(
    step.id,
  );
  return idMatch ? idMatch.slice(1).join("-") : null;
}
