"""RabbitMQ publisher for realtime stock quote events."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from aio_pika import DeliveryMode, ExchangeType, Message, connect_robust
from aio_pika.abc import (
    AbstractRobustChannel,
    AbstractRobustConnection,
    AbstractRobustExchange,
)

from app.config import settings

logger = logging.getLogger(__name__)


class RealtimeEventPublisher:
    """Publish realtime stock quote updates to RabbitMQ."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._connection: AbstractRobustConnection | None = None
        self._channel: AbstractRobustChannel | None = None
        self._exchange: AbstractRobustExchange | None = None

    async def start(self) -> None:
        """Initialize connection/channel/exchange/queue topology."""
        if not settings.PRICE_PUSH_MQ_ENABLED:
            logger.info("Realtime MQ publisher disabled by config")
            return

        async with self._lock:
            if self._connection is not None and not self._connection.is_closed:
                return

            self._connection = await connect_robust(
                host=settings.RABBITMQ_HOST,
                port=settings.RABBITMQ_PORT,
                login=settings.RABBITMQ_USERNAME,
                password=settings.RABBITMQ_PASSWORD,
                virtualhost=settings.RABBITMQ_VHOST,
            )
            self._channel = await self._connection.channel()
            self._exchange = await self._channel.declare_exchange(
                settings.PRICE_PUSH_MQ_EXCHANGE,
                ExchangeType.DIRECT,
                durable=True,
            )
            dlx = await self._channel.declare_exchange(
                settings.PRICE_PUSH_MQ_DLX,
                ExchangeType.DIRECT,
                durable=True,
            )
            queue = await self._channel.declare_queue(
                settings.PRICE_PUSH_MQ_QUEUE,
                durable=True,
                arguments={
                    "x-dead-letter-exchange": settings.PRICE_PUSH_MQ_DLX,
                    "x-dead-letter-routing-key": settings.PRICE_PUSH_MQ_DLK,
                },
            )
            await queue.bind(self._exchange, routing_key=settings.PRICE_PUSH_MQ_ROUTING_KEY)
            dlq = await self._channel.declare_queue(settings.PRICE_PUSH_MQ_DLQ, durable=True)
            await dlq.bind(dlx, routing_key=settings.PRICE_PUSH_MQ_DLK)

            logger.info(
                "Realtime MQ publisher connected: exchange=%s queue=%s routing_key=%s",
                settings.PRICE_PUSH_MQ_EXCHANGE,
                settings.PRICE_PUSH_MQ_QUEUE,
                settings.PRICE_PUSH_MQ_ROUTING_KEY,
            )

    async def close(self) -> None:
        """Close channel and connection gracefully."""
        async with self._lock:
            if self._channel is not None and not self._channel.is_closed:
                await self._channel.close()
            if self._connection is not None and not self._connection.is_closed:
                await self._connection.close()
            self._channel = None
            self._connection = None
            self._exchange = None

    async def publish_stock_realtime(self, data: dict[str, Any]) -> bool:
        """Publish one realtime event payload."""
        if not settings.PRICE_PUSH_MQ_ENABLED:
            return False
        if not data or not data.get("symbol"):
            return False

        try:
            await self.start()
            if self._exchange is None:
                return False

            payload = self._build_payload(data)
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            message = Message(
                body=body,
                content_type="application/json",
                delivery_mode=DeliveryMode.PERSISTENT,
                timestamp=datetime.now(timezone.utc),
            )
            await self._exchange.publish(message, routing_key=settings.PRICE_PUSH_MQ_ROUTING_KEY)
            return True
        except Exception as exc:
            logger.warning(
                "Failed to publish realtime event for %s: %s",
                data.get("symbol"),
                exc,
            )
            return False

    @staticmethod
    def _build_payload(data: dict[str, Any]) -> dict[str, Any]:
        return {
            "symbol": data.get("symbol"),
            "name": data.get("name"),
            "type": data.get("type", "STOCK"),
            "price": data.get("price"),
            "changeAmount": data.get("change"),
            "changePercent": data.get("change_percent"),
            "volume": data.get("volume"),
            "amount": data.get("amount"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


realtime_event_publisher = RealtimeEventPublisher()
