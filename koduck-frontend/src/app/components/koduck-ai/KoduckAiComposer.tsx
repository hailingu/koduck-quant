import { type RefObject } from "react";
import { ArrowUp, ChevronDown, FileText, Mic, Paperclip, Square, X } from "lucide-react";
import type { LlmOptionsConfig, LlmProvider, UploadedFile } from "./types";

interface KoduckAiComposerProps {
  chatInputRef: RefObject<HTMLTextAreaElement>;
  chatMessage: string;
  llmOptions: LlmOptionsConfig;
  selectedProvider: LlmProvider;
  selectedModel: string;
  uploadedFiles: UploadedFile[];
  sending: boolean;
  onFilePickerClick: () => void;
  onMessageChange: (value: string, target: HTMLTextAreaElement) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onProviderChange: (provider: LlmProvider) => void;
  onModelChange: (model: string) => void;
  onRemoveFile: (fileId: string) => void;
  onSend: () => void;
  onStop: () => void;
}

export function KoduckAiComposer({
  chatInputRef,
  chatMessage,
  llmOptions,
  selectedProvider,
  selectedModel,
  uploadedFiles,
  sending,
  onFilePickerClick,
  onMessageChange,
  onKeyDown,
  onProviderChange,
  onModelChange,
  onRemoveFile,
  onSend,
  onStop,
}: KoduckAiComposerProps) {
  return (
    <div className="rounded-[32px] border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-2 pt-4">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 pr-2 transition-colors hover:bg-gray-50"
            >
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
                  <FileText className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">{file.name}</div>
                <div className="text-xs text-gray-500">File</div>
              </div>
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-gray-800"
                onClick={() => onRemoveFile(file.id)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-4">
        <textarea
          ref={chatInputRef}
          placeholder="询问问题,尽管问..."
          value={chatMessage}
          onChange={(event) => onMessageChange(event.target.value, event.target)}
          onKeyDown={onKeyDown}
          rows={1}
          className="w-full resize-none overflow-hidden border-0 bg-transparent text-base text-gray-800 outline-none placeholder:text-gray-400"
        />
      </div>

      <div className="flex items-center gap-2 px-5 pb-3">
        <div className="flex flex-1 items-center gap-1.5">
          <button
            className="p-1.5 text-gray-400 transition-colors hover:text-gray-600"
            onClick={onFilePickerClick}
            type="button"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <div className="relative">
            <select
              value={selectedProvider}
              onChange={(event) => onProviderChange(event.target.value as LlmProvider)}
              className="appearance-none rounded-lg px-2.5 py-1 pr-7 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none"
            >
              {llmOptions.providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(event) => onModelChange(event.target.value)}
              className="appearance-none rounded-lg px-2.5 py-1 pr-7 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none"
            >
              {(llmOptions.modelOptionsByProvider[selectedProvider] ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="p-1.5 text-gray-400 transition-colors hover:text-gray-600"
            type="button"
          >
            <Mic className="h-4 w-4" />
          </button>
          {sending ? (
            <button
              onClick={onStop}
              type="button"
              aria-label="终止本轮请求"
              title="终止"
              className="koduck-stop-button flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!chatMessage.trim()}
              type="button"
              aria-label="发送消息"
              title="发送"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                chatMessage.trim()
                  ? "bg-gray-700 text-white hover:bg-gray-800"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
