#!/usr/bin/env python3
"""Koduck .

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


# 
_exit_requested = False


def _signal_handler(sig: int, frame: Any) -> None:
    """ Ctrl+C ."""
    global _exit_requested
    _exit_requested = True
    print("\n\n👋 Goodbye!")
    sys.exit(0)


class InteractiveChat:
    """."""

    def __init__(self, provider: str | None = None, model: str | None = None,
                 api_key: str | None = None, api_base: str | None = None):
        """."""
        self.client = create_client(
            provider=provider,
            model=model,
            api_key=api_key,
            api_base=api_base,
        )
        self.messages: list[Message] = []
        self.running = True

    def print_banner(self) -> None:
        """."""
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
        """."""
        print("\n:")
        print("  /help     ")
        print("  /quit     ")
        print("  /clear    ")
        print("  /history  ")
        print()

    def show_history(self) -> None:
        """."""
        if not self.messages:
            print("\n[]\n")
            return

        print("\n" + "=" * 40)
        print(":")
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
        """."""
        self.messages.clear()
        print("\n[]\n")

    async def process_message(self, user_input: str) -> None:
        """."""
        # 
        self.messages.append(Message(role="user", content=user_input))

        try:
            print("\n🤔 ...")
            response = await self.client.generate(self.messages)

            # 
            self.messages.append(Message(role="assistant", content=response.content))

            #  ()
            self.messages.append(Message(
                role="assistant",
                content=response.content,
                thinking=response.thinking,
            ))

            #  ()
            if response.thinking:
                print(f"\n💭 Thinking:")
                print(response.thinking)
                print()

            # 
            print(f"🦆 {self.client.provider.value}:")
            print(response.content)

            #  token 
            if response.usage:
                print(f"\n📊 Tokens: {response.usage.total_tokens} "
                      f"(prompt: {response.usage.prompt_tokens}, "
                      f"completion: {response.usage.completion_tokens})")

        except Exception as e:
            logger.error(f": {e}")
            print(f"\n❌ : {e}")

    def handle_command(self, cmd: str) -> bool:
        """，."""
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
            print(f"\n: {self.client.model}\n")

        else:
            print(f"\n: {cmd}")
            print(" /help \n")

        return True

    async def run(self) -> None:
        """."""
        self.print_banner()

        try:
            while self.running:
                try:
                    # 
                    user_input = input("\nYou: ").strip()

                    if not user_input:
                        continue

                    # 
                    if user_input.startswith("/"):
                        if not self.handle_command(user_input):
                            break
                        continue

                    # 
                    await self.process_message(user_input)

                except EOFError:
                    print("\n\n👋 Goodbye!")
                    break
                except Exception as e:
                    logger.error(f": {e}")
                    print(f"\n❌ : {e}")
        except asyncio.CancelledError:
            # 
            pass


def setup_logging(verbose: bool = False) -> None:
    """."""
    level = logging.DEBUG if verbose else logging.WARNING
    format_str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    logging.basicConfig(level=level, format=format_str)


def get_available_providers() -> list[str]:
    """."""
    return [p.value for p in LLMProvider]


def create_parser() -> argparse.ArgumentParser:
    """."""
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
  python -m koduck                    #  (MiniMax)
  python -m koduck --provider deepseek    #  DeepSeek
  python -m koduck --provider openai -m gpt-4o-mini    #  OpenAI
  python -m koduck -p minimax -m MiniMax-M2.7    #  MiniMax 
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
    """."""
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
        # ，
        pass
    except ValueError as e:
        print(f"❌ : {e}")
        print("\n API :")
        print("  export LLM_API_KEY=your-api-key")
        print("\n .env :")
        print("  cp .env.template .env")
        sys.exit(1)
    except Exception as e:
        logger.exception("")
        print(f"❌ : {e}")
        sys.exit(1)


def main() -> None:
    """."""
    # ， Ctrl+C 
    signal.signal(signal.SIGINT, _signal_handler)
    
    try:
        asyncio.run(main_async())
    except (KeyboardInterrupt, asyncio.CancelledError):
        # Ctrl+C 
        # ，
        pass


if __name__ == "__main__":
    main()
