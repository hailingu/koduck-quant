#!/usr/bin/env python3
"""Koduck 交互式命令行界面.

Usage:
    python -m koduck [OPTIONS]
    python -m koduck --provider deepseek

交互命令:
    /help       显示帮助
    /quit       退出程序
    /clear      清空对话历史
    /history    显示对话历史
"""

import argparse
import asyncio
import logging
import signal
import sys
from typing import Any

from koduck import create_client, Message, __version__
from koduck.schema import LLMProvider

logger = logging.getLogger(__name__)


# 全局退出标志
_exit_requested = False


def _signal_handler(sig: int, frame: Any) -> None:
    """处理 Ctrl+C 信号."""
    global _exit_requested
    _exit_requested = True
    print("\n\n👋 Goodbye!")
    sys.exit(0)


class InteractiveChat:
    """交互式聊天会话."""

    def __init__(self, provider: str | None = None, model: str | None = None,
                 api_key: str | None = None, api_base: str | None = None):
        """初始化聊天会话."""
        self.client = create_client(
            provider=provider,
            model=model,
            api_key=api_key,
            api_base=api_base,
        )
        self.messages: list[Message] = []
        self.running = True

    def print_banner(self) -> None:
        """打印启动横幅."""
        print("\n🦆 Koduck LLM Caller")
        print("=" * 40)
        print(f"Version: {__version__}")
        print(f"Provider: {self.client.provider.value}")
        print(f"Model: {self.client.model}")
        print()
        print("Commands: /help, /quit, /clear, /history")
        print("=" * 40)
        print()

    def print_help(self) -> None:
        """打印帮助信息."""
        print("\n可用命令:")
        print("  /help     显示此帮助")
        print("  /quit     退出程序")
        print("  /clear    清空对话历史")
        print("  /history  显示对话历史")
        print()

    def show_history(self) -> None:
        """显示对话历史."""
        if not self.messages:
            print("\n[对话历史为空]\n")
            return

        print("\n" + "=" * 40)
        print("对话历史:")
        print("=" * 40)
        for i, msg in enumerate(self.messages, 1):
            role = msg.role.upper()
            content = msg.content or ""
            if len(content) > 100:
                content = content[:97] + "..."
            print(f"{i}. [{role}] {content}")
        print("=" * 40)
        print()

    def clear_history(self) -> None:
        """清空对话历史."""
        self.messages.clear()
        print("\n[对话历史已清空]\n")

    async def process_message(self, user_input: str) -> None:
        """处理用户消息并获取回复."""
        # 添加用户消息到历史
        self.messages.append(Message(role="user", content=user_input))

        try:
            print("\n🤔 思考中...")
            response = await self.client.generate(self.messages)

            # 添加助手回复到历史
            self.messages.append(Message(role="assistant", content=response.content))

            # 添加助手回复到历史 (包含思考内容)
            self.messages.append(Message(
                role="assistant",
                content=response.content,
                thinking=response.thinking,
            ))

            # 打印思考内容 (如果存在)
            if response.thinking:
                print(f"\n💭 Thinking:")
                print(response.thinking)
                print()

            # 打印回复
            print(f"🦆 {self.client.provider.value}:")
            print(response.content)

            # 显示 token 使用情况
            if response.usage:
                print(f"\n📊 Tokens: {response.usage.total_tokens} "
                      f"(prompt: {response.usage.prompt_tokens}, "
                      f"completion: {response.usage.completion_tokens})")

        except Exception as e:
            logger.error(f"生成回复失败: {e}")
            print(f"\n❌ 错误: {e}")

    def handle_command(self, cmd: str) -> bool:
        """处理命令，返回是否继续运行."""
        cmd = cmd.lower().strip()

        if cmd in ["/quit", "/exit", "/q"]:
            print("\n👋 Goodbye!")
            self.running = False
            return False

        elif cmd == "/help":
            self.print_help()

        elif cmd == "/clear":
            self.clear_history()

        elif cmd == "/history":
            self.show_history()

        elif cmd == "/model":
            print(f"\n当前模型: {self.client.model}\n")

        else:
            print(f"\n未知命令: {cmd}")
            print("输入 /help 查看可用命令\n")

        return True

    async def run(self) -> None:
        """运行交互式会话."""
        self.print_banner()

        try:
            while self.running:
                try:
                    # 获取用户输入
                    user_input = input("\nYou: ").strip()

                    if not user_input:
                        continue

                    # 处理命令
                    if user_input.startswith("/"):
                        if not self.handle_command(user_input):
                            break
                        continue

                    # 处理普通消息
                    await self.process_message(user_input)

                except EOFError:
                    print("\n\n👋 Goodbye!")
                    break
                except Exception as e:
                    logger.error(f"运行时错误: {e}")
                    print(f"\n❌ 错误: {e}")
        except asyncio.CancelledError:
            # 任务被取消时优雅退出
            pass


def setup_logging(verbose: bool = False) -> None:
    """配置日志."""
    level = logging.DEBUG if verbose else logging.WARNING
    format_str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    logging.basicConfig(level=level, format=format_str)


def get_available_providers() -> list[str]:
    """获取可用的提供商列表."""
    return [p.value for p in LLMProvider]


def create_parser() -> argparse.ArgumentParser:
    """创建命令行参数解析器."""
    parser = argparse.ArgumentParser(
        prog="koduck",
        description="Koduck - 交互式多平台 LLM 客户端",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
交互式命令:
  /help       显示帮助
  /quit       退出程序
  /clear      清空对话历史
  /history    显示对话历史

示例:
  python -m koduck                    # 使用默认配置 (MiniMax)
  python -m koduck --provider deepseek    # 使用 DeepSeek
  python -m koduck --provider openai -m gpt-4o-mini    # 使用 OpenAI
  python -m koduck -p minimax -m MiniMax-M2.5    # 使用 MiniMax 和指定模型
        """,
    )

    parser.add_argument(
        "-p", "--provider",
        type=str,
        default=None,
        choices=get_available_providers(),
        help="LLM 提供商 (minimax/deepseek/openai)",
    )

    parser.add_argument(
        "-m", "--model",
        type=str,
        default=None,
        help="模型名称",
    )

    parser.add_argument(
        "--api-key",
        type=str,
        default=None,
        help="API 密钥",
    )

    parser.add_argument(
        "--api-base",
        type=str,
        default=None,
        help="API 基础 URL",
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="显示详细日志",
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )

    return parser


async def main_async() -> None:
    """异步主入口."""
    parser = create_parser()
    args = parser.parse_args()

    setup_logging(verbose=args.verbose)

    try:
        chat = InteractiveChat(
            provider=args.provider,
            model=args.model,
            api_key=args.api_key,
            api_base=args.api_base,
        )
        await chat.run()
    except asyncio.CancelledError:
        # 正常退出，不显示错误
        pass
    except ValueError as e:
        print(f"❌ 配置错误: {e}")
        print("\n请确保已设置 API 密钥:")
        print("  export LLM_API_KEY=your-api-key")
        print("\n或创建 .env 文件:")
        print("  cp .env.template .env")
        sys.exit(1)
    except Exception as e:
        logger.exception("程序异常")
        print(f"❌ 程序错误: {e}")
        sys.exit(1)


def main() -> None:
    """主入口函数."""
    # 注册信号处理器，确保单次 Ctrl+C 就能退出
    signal.signal(signal.SIGINT, _signal_handler)
    
    try:
        asyncio.run(main_async())
    except (KeyboardInterrupt, asyncio.CancelledError):
        # Ctrl+C 或任务取消时优雅退出
        # 消息已在信号处理器中打印，这里只捕获异常防止堆栈输出
        pass


if __name__ == "__main__":
    main()
