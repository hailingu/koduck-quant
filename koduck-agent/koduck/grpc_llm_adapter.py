"""Minimal gRPC LLM adapter stub for koduck-ai integration tests.

This module is intentionally isolated from the existing FastAPI server.
Run it as:
    python -m koduck.grpc_llm_adapter --host 0.0.0.0 --port 50054
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import importlib.util
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import grpc
from grpc_tools import protoc

from koduck.client_factory import create_client
from koduck.config import load_config
from koduck.schema import Message

LOGGER = logging.getLogger(__name__)

SHARED_PROTO = """syntax = "proto3";
package koduck.contract.v1;
message RequestMeta {
  string request_id = 1;
  string session_id = 2;
  string user_id = 3;
  string tenant_id = 4;
  string trace_id = 5;
  string idempotency_key = 6;
  int64 deadline_ms = 7;
  string api_version = 8;
}
message ErrorDetail {
  string code = 1;
  string message = 2;
  bool retryable = 3;
  bool degraded = 4;
  string upstream = 5;
  int64 retry_after_ms = 6;
}
message Capability {
  string service = 1;
  repeated string contract_versions = 2;
  map<string, string> features = 3;
  map<string, string> limits = 4;
}
"""

LLM_PROTO = """syntax = "proto3";
package koduck.llm.v1;
import "koduck/contract/v1/shared.proto";
service LlmService {
  rpc GetCapabilities(koduck.contract.v1.RequestMeta) returns (koduck.contract.v1.Capability);
  rpc ListModels(ListModelsRequest) returns (ListModelsResponse);
  rpc CountTokens(CountTokensRequest) returns (CountTokensResponse);
  rpc Generate(GenerateRequest) returns (GenerateResponse);
  rpc StreamGenerate(GenerateRequest) returns (stream StreamGenerateEvent);
}
message ListModelsRequest {
  koduck.contract.v1.RequestMeta meta = 1;
  string provider = 2;
}
message ListModelsResponse {
  bool ok = 1;
  repeated ModelInfo models = 2;
  koduck.contract.v1.ErrorDetail error = 3;
}
message CountTokensRequest {
  koduck.contract.v1.RequestMeta meta = 1;
  string model = 2;
  repeated ChatMessage messages = 3;
}
message CountTokensResponse {
  bool ok = 1;
  int32 total_tokens = 2;
  koduck.contract.v1.ErrorDetail error = 3;
}
message GenerateRequest {
  koduck.contract.v1.RequestMeta meta = 1;
  string model = 2;
  repeated ChatMessage messages = 3;
  float temperature = 4;
  float top_p = 5;
  int32 max_tokens = 6;
  repeated ToolDefinition tools = 7;
  string response_format = 8;
  string provider = 9;
}
message GenerateResponse {
  bool ok = 1;
  ChatMessage message = 2;
  string finish_reason = 3;
  TokenUsage usage = 4;
  koduck.contract.v1.ErrorDetail error = 5;
}
message StreamGenerateEvent {
  string event_id = 1;
  int32 sequence_num = 2;
  string delta = 3;
  string finish_reason = 4;
  TokenUsage usage = 5;
  koduck.contract.v1.ErrorDetail error = 6;
}
message ChatMessage {
  string role = 1;
  string content = 2;
  string name = 3;
  map<string, string> metadata = 4;
}
message ToolDefinition {
  string name = 1;
  string description = 2;
  string input_schema = 3;
}
message TokenUsage {
  int32 prompt_tokens = 1;
  int32 completion_tokens = 2;
  int32 total_tokens = 3;
}
message ModelInfo {
  string id = 1;
  string provider = 2;
  string display_name = 3;
  int32 max_context_tokens = 4;
  int32 max_output_tokens = 5;
  bool supports_streaming = 6;
  bool supports_tools = 7;
  repeated string supported_features = 8;
}
"""


def _compile_proto_to_temp() -> tuple[Any, Any]:
    tmp_dir = tempfile.TemporaryDirectory(prefix="koduck-llm-proto-")
    root = Path(tmp_dir.name)
    (root / "koduck/contract/v1").mkdir(parents=True, exist_ok=True)
    (root / "koduck/llm/v1").mkdir(parents=True, exist_ok=True)
    (root / "koduck/contract/v1/shared.proto").write_text(SHARED_PROTO, encoding="utf-8")
    (root / "koduck/llm/v1/llm.proto").write_text(LLM_PROTO, encoding="utf-8")

    args = [
        "",
        f"-I{root}",
        f"--python_out={root}",
        f"--grpc_python_out={root}",
        str(root / "koduck/contract/v1/shared.proto"),
        str(root / "koduck/llm/v1/llm.proto"),
    ]
    rc = protoc.main(args)
    if rc != 0:
        raise RuntimeError(f"failed to compile proto, exit={rc}")

    shared_pb2 = _load_generated_module(
        "koduck.contract.v1.shared_pb2",
        root / "koduck/contract/v1/shared_pb2.py",
    )
    llm_pb2 = _load_generated_module(
        "koduck.llm.v1.llm_pb2",
        root / "koduck/llm/v1/llm_pb2.py",
    )
    llm_pb2_grpc = _load_generated_module(
        "koduck.llm.v1.llm_pb2_grpc",
        root / "koduck/llm/v1/llm_pb2_grpc.py",
    )
    # Hold TemporaryDirectory object via module-level reference.
    _PROTO_TEMP_DIR_HOLDER.append(tmp_dir)
    return shared_pb2, llm_pb2, llm_pb2_grpc


_PROTO_TEMP_DIR_HOLDER: list[tempfile.TemporaryDirectory[str]] = []

KNOWN_PROVIDERS = {"openai", "minimax", "deepseek"}


def _load_generated_module(fullname: str, path: Path) -> Any:
    _ensure_parent_packages(fullname)
    spec = importlib.util.spec_from_file_location(fullname, path)
    if not spec or not spec.loader:
        raise RuntimeError(f"failed to load module spec for {fullname}")
    module = importlib.util.module_from_spec(spec)
    import sys

    sys.modules[fullname] = module
    spec.loader.exec_module(module)
    return module


def _ensure_parent_packages(fullname: str) -> None:
    import sys
    import types

    parts = fullname.split(".")
    for i in range(1, len(parts)):
        pkg_name = ".".join(parts[:i])
        if pkg_name in sys.modules:
            continue
        pkg = types.ModuleType(pkg_name)
        pkg.__path__ = []  # type: ignore[attr-defined]
        sys.modules[pkg_name] = pkg


SHARED_PB2, LLM_PB2, LLM_PB2_GRPC = _compile_proto_to_temp()


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


class LlmServiceStub(LLM_PB2_GRPC.LlmServiceServicer):
    def __init__(self, default_provider: str = "minimax", default_model: str = "MiniMax-M2.7") -> None:
        self.default_provider = default_provider
        self.default_model = default_model
        self._config = load_config()

    async def GetCapabilities(self, request: Any, context: grpc.aio.ServicerContext) -> Any:
        return SHARED_PB2.Capability(
            service="llm",
            contract_versions=["v1"],
            features={
                "generate": "true",
                "stream_generate": "true",
                "stub_mode": "true",
            },
            limits={
                "max_tokens": "32768",
                "max_stream_seconds": "300",
            },
        )

    async def ListModels(self, request: Any, context: grpc.aio.ServicerContext) -> Any:
        provider = request.provider or self.default_provider
        return LLM_PB2.ListModelsResponse(
            ok=True,
            models=[
                LLM_PB2.ModelInfo(
                    id=self.default_model,
                    provider=provider,
                    display_name="Koduck Stub Model",
                    max_context_tokens=32768,
                    max_output_tokens=4096,
                    supports_streaming=True,
                    supports_tools=False,
                    supported_features=["stub"],
                )
            ],
        )

    async def CountTokens(self, request: Any, context: grpc.aio.ServicerContext) -> Any:
        total = 0
        for msg in request.messages:
            total += _estimate_tokens(msg.content or "")
        return LLM_PB2.CountTokensResponse(ok=True, total_tokens=total)

    async def Generate(self, request: Any, context: grpc.aio.ServicerContext) -> Any:
        question = request.messages[-1].content if request.messages else ""
        provider = request.provider or self.default_provider
        model = request.model or self.default_model

        try:
            response = await self._generate_with_client(provider, model, request.messages)
            usage = response.usage
            return LLM_PB2.GenerateResponse(
                ok=True,
                message=LLM_PB2.ChatMessage(role="assistant", content=response.content or ""),
                finish_reason=response.finish_reason or "stop",
                usage=LLM_PB2.TokenUsage(
                    prompt_tokens=usage.prompt_tokens if usage else _estimate_tokens(question),
                    completion_tokens=usage.completion_tokens if usage else _estimate_tokens(response.content or ""),
                    total_tokens=usage.total_tokens if usage else _estimate_tokens(question) + _estimate_tokens(response.content or ""),
                ),
            )
        except Exception as exc:
            LOGGER.exception("koduck-agent llm generate failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"llm generate failed: {exc}")
            return LLM_PB2.GenerateResponse(
                ok=False,
                error=SHARED_PB2.ErrorDetail(
                    code="INTERNAL_ERROR",
                    message=f"llm generate failed: {exc}",
                    retryable=False,
                    degraded=False,
                    upstream="llm",
                    retry_after_ms=0,
                ),
            )

    async def StreamGenerate(self, request: Any, context: grpc.aio.ServicerContext):
        question = request.messages[-1].content if request.messages else ""
        provider = request.provider or self.default_provider
        model = request.model or self.default_model

        try:
            client, internal_messages = self._build_client_and_messages(provider, model, request.messages)
        except Exception as exc:
            LOGGER.exception("koduck-agent llm stream_generate failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"llm stream_generate failed: {exc}")
            return

        sequence_num = 0
        completion_text_parts: list[str] = []
        try:
            async for delta in client.generate_stream(internal_messages):
                if not delta:
                    continue
                sequence_num += 1
                completion_text_parts.append(delta)
                yield LLM_PB2.StreamGenerateEvent(
                    event_id=f"evt_{sequence_num:05d}",
                    sequence_num=sequence_num,
                    delta=delta,
                )
        except Exception as exc:
            LOGGER.exception("koduck-agent llm stream_generate failed during upstream stream")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"llm stream_generate failed: {exc}")
            return

        content = "".join(completion_text_parts)
        prompt_tokens = _estimate_tokens(question)
        completion_tokens = _estimate_tokens(content)
        yield LLM_PB2.StreamGenerateEvent(
            event_id="evt_done",
            sequence_num=max(sequence_num + 1, 99999),
            finish_reason="stop",
            usage=LLM_PB2.TokenUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )

    async def _generate_with_client(self, provider: str, model: str, messages: Any) -> Any:
        client, internal_messages = self._build_client_and_messages(provider, model, messages)
        return await client.generate(internal_messages)

    def _build_client_and_messages(self, provider: str, model: str, messages: Any):
        config = self._config
        configured_provider = os.getenv("LLM_PROVIDER") or config.provider.value or self.default_provider
        configured_model = os.getenv("LLM_MODEL") or config.model or self.default_model
        inbound_provider = (provider or "").strip().lower()
        inbound_model = (model or "").strip()

        # koduck-ai 当前会把 default_provider 同时塞进 provider/model。
        # 当它们只是占位值时，优先使用 deployment 中显式配置的真实 provider/model。
        resolved_provider = configured_provider
        if inbound_provider and inbound_provider not in KNOWN_PROVIDERS:
            resolved_provider = inbound_provider

        resolved_model = configured_model
        if inbound_model and inbound_model.lower() not in KNOWN_PROVIDERS:
            resolved_model = inbound_model

        resolved_api_key = os.getenv("LLM_API_KEY") or config.api_key
        resolved_api_base = os.getenv("LLM_API_BASE") or config.api_base

        if not resolved_api_key:
            raise RuntimeError("LLM_API_KEY is not configured")

        LOGGER.info(
            "using llm client provider=%s model=%s api_base=%s",
            resolved_provider,
            resolved_model,
            resolved_api_base,
        )

        client = create_client(
            api_key=resolved_api_key,
            provider=resolved_provider,
            api_base=resolved_api_base,
            model=resolved_model,
            retry_config=config.retry,
        )
        internal_messages = [
            Message(role=msg.role or "user", content=msg.content or "")
            for msg in messages
        ]
        return client, internal_messages


async def serve(host: str, port: int, provider: str, model: str) -> None:
    server = grpc.aio.server()
    LLM_PB2_GRPC.add_LlmServiceServicer_to_server(
        LlmServiceStub(default_provider=provider, default_model=model),
        server,
    )
    listen_addr = f"{host}:{port}"
    server.add_insecure_port(listen_addr)
    await server.start()
    LOGGER.info("koduck-agent llm grpc adapter started at %s", listen_addr)
    await server.wait_for_termination()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run koduck-agent gRPC LLM adapter server.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=50054)
    parser.add_argument("--provider", default="minimax")
    parser.add_argument("--model", default="MiniMax-M2.7")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    asyncio.run(serve(args.host, args.port, args.provider, args.model))


if __name__ == "__main__":
    main()
