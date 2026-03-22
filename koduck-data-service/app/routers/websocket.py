"""WebSocket real-time price streaming router.

Issue #135: WebSocket 实时价格推送系统
Provides real-time price updates via WebSocket connections.
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Set
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from starlette.websockets import WebSocketState

from app.services.akshare_client import akshare_client
from app.services.eastmoney_client import eastmoney_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Manage WebSocket connections and subscriptions."""
    
    def __init__(self):
        # symbol -> set of websockets
        self.symbol_subscriptions: Dict[str, Set[WebSocket]] = {}
        # websocket -> set of symbols
        self.client_subscriptions: Dict[WebSocket, Set[str]] = {}
        # Track all active connections
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.client_subscriptions[websocket] = set()
        logger.info(f"New WebSocket connection. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Handle disconnection and cleanup subscriptions."""
        # Remove from symbol subscriptions
        subscribed_symbols = self.client_subscriptions.get(websocket, set())
        for symbol in subscribed_symbols:
            if symbol in self.symbol_subscriptions:
                self.symbol_subscriptions[symbol].discard(websocket)
                if not self.symbol_subscriptions[symbol]:
                    del self.symbol_subscriptions[symbol]
        
        # Cleanup client tracking
        self.client_subscriptions.pop(websocket, None)
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    def subscribe(self, websocket: WebSocket, symbols: List[str]):
        """Subscribe websocket to list of symbols."""
        for symbol in symbols:
            # Add to symbol -> websocket mapping
            if symbol not in self.symbol_subscriptions:
                self.symbol_subscriptions[symbol] = set()
            self.symbol_subscriptions[symbol].add(websocket)
            
            # Add to websocket -> symbols mapping
            self.client_subscriptions[websocket].add(symbol)
        
        logger.debug(f"Client subscribed to {len(symbols)} symbols: {symbols}")
    
    def unsubscribe(self, websocket: WebSocket, symbols: Optional[List[str]] = None):
        """Unsubscribe from symbols. If symbols is None, unsubscribe all."""
        if symbols is None:
            symbols = list(self.client_subscriptions.get(websocket, set()))
        
        for symbol in symbols:
            if symbol in self.symbol_subscriptions:
                self.symbol_subscriptions[symbol].discard(websocket)
                if not self.symbol_subscriptions[symbol]:
                    del self.symbol_subscriptions[symbol]
            
            self.client_subscriptions[websocket].discard(symbol)
        
        logger.debug(f"Client unsubscribed from {len(symbols)} symbols")
    
    async def broadcast_to_symbol(self, symbol: str, message: dict):
        """Broadcast message to all clients subscribed to a symbol."""
        if symbol not in self.symbol_subscriptions:
            return
        
        websockets = list(self.symbol_subscriptions[symbol])
        disconnected = []
        
        for websocket in websockets:
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to websocket: {e}")
                disconnected.append(websocket)
        
        # Cleanup disconnected clients
        for ws in disconnected:
            self.disconnect(ws)
    
    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            "active_connections": len(self.active_connections),
            "subscribed_symbols": len(self.symbol_subscriptions),
            "total_subscriptions": sum(
                len(subs) for subs in self.symbol_subscriptions.values()
            ),
        }


# Global connection manager
manager = ConnectionManager()


class PriceUpdateService:
    """Service to fetch and broadcast price updates."""
    
    def __init__(self):
        self.is_running = False
        self.update_task: Optional[asyncio.Task] = None
        self.update_interval = 3.0  # Update every 3 seconds
    
    async def start(self):
        """Start the price update service."""
        if self.is_running:
            return
        
        self.is_running = True
        self.update_task = asyncio.create_task(self._update_loop())
        logger.info("Price update service started")
    
    async def stop(self):
        """Stop the price update service."""
        self.is_running = False
        if self.update_task:
            self.update_task.cancel()
            try:
                await self.update_task
            except asyncio.CancelledError:
                pass
        logger.info("Price update service stopped")
    
    async def _update_loop(self):
        """Main update loop - fetch prices and broadcast."""
        while self.is_running:
            try:
                await self._broadcast_updates()
                await asyncio.sleep(self.update_interval)
            except Exception as e:
                logger.error(f"Error in update loop: {e}")
                await asyncio.sleep(self.update_interval)
    
    async def _broadcast_updates(self):
        """Fetch prices for subscribed symbols and broadcast."""
        symbols = list(manager.symbol_subscriptions.keys())
        if not symbols:
            return
        
        # Batch fetch prices (up to 50 symbols per request)
        batch_size = 50
        for i in range(0, len(symbols), batch_size):
            batch = symbols[i:i + batch_size]
            try:
                # Fetch real-time quotes
                quotes = await asyncio.to_thread(
                    eastmoney_client.fetch_batch_detailed,
                    batch
                )
                
                # Broadcast to each symbol's subscribers
                for symbol, quote in quotes.items():
                    if symbol in manager.symbol_subscriptions:
                        message = {
                            "type": "PRICE_UPDATE",
                            "data": {
                                "symbol": symbol,
                                "price": quote.get("price"),
                                "open": quote.get("open"),
                                "high": quote.get("high"),
                                "low": quote.get("low"),
                                "prev_close": quote.get("prev_close"),
                                "change": quote.get("change"),
                                "change_percent": quote.get("change_percent"),
                                "volume": quote.get("volume"),
                                "amount": quote.get("amount"),
                                "bid_price": quote.get("bid_price"),
                                "ask_price": quote.get("ask_price"),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        }
                        await manager.broadcast_to_symbol(symbol, message)
                        
            except Exception as e:
                logger.error(f"Failed to fetch/broadcast prices: {e}")


# Global price update service
price_service = PriceUpdateService()


@router.websocket("/ws/prices")
async def websocket_prices(websocket: WebSocket):
    """WebSocket endpoint for real-time price updates.
    
    Issue #135: WebSocket 实时价格推送系统
    
    Protocol:
    1. Client connects and sends SUBSCRIBE message with symbols list
    2. Server pushes PRICE_UPDATE messages when prices change
    3. Client can send UNSUBSCRIBE to stop receiving updates
    4. Server sends PING every 30s, client should respond with PONG
    
    Message formats:
    - SUBSCRIBE: {"type": "SUBSCRIBE", "symbols": ["600519", "000858"]}
    - UNSUBSCRIBE: {"type": "UNSUBSCRIBE", "symbols": ["600519"]} or {"type": "UNSUBSCRIBE", "symbols": null} for all
    - PONG: {"type": "PONG"}
    
    Server messages:
    - PRICE_UPDATE: {"type": "PRICE_UPDATE", "data": {...}}
    - PING: {"type": "PING"}
    - ERROR: {"type": "ERROR", "message": "..."}
    """
    await manager.connect(websocket)
    
    # Start price service if not running
    if not price_service.is_running:
        await price_service.start()
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "SUBSCRIBE":
                    symbols = message.get("symbols", [])
                    if symbols:
                        manager.subscribe(websocket, symbols)
                        await websocket.send_json({
                            "type": "SUBSCRIBED",
                            "symbols": symbols,
                            "count": len(symbols)
                        })
                    else:
                        await websocket.send_json({
                            "type": "ERROR",
                            "message": "No symbols provided for subscription"
                        })
                
                elif msg_type == "UNSUBSCRIBE":
                    symbols = message.get("symbols")
                    manager.unsubscribe(websocket, symbols)
                    await websocket.send_json({
                        "type": "UNSUBSCRIBED",
                        "symbols": symbols or "all"
                    })
                
                elif msg_type == "PONG":
                    # Client responding to server ping
                    pass
                
                else:
                    await websocket.send_json({
                        "type": "ERROR",
                        "message": f"Unknown message type: {msg_type}"
                    })
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "ERROR",
                    "message": "Invalid JSON format"
                })
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.websocket("/ws/watchlist/{user_id}")
async def websocket_watchlist(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for user's watchlist updates.
    
    Automatically subscribes to user's watchlist stocks.
    """
    await manager.connect(websocket)
    
    if not price_service.is_running:
        await price_service.start()
    
    try:
        # TODO: Fetch user's watchlist from database
        # For now, use default symbols
        default_symbols = ["600519", "000858", "300750", "002594"]
        manager.subscribe(websocket, default_symbols)
        
        await websocket.send_json({
            "type": "CONNECTED",
            "user_id": user_id,
            "watchlist": default_symbols
        })
        
        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "PONG":
                    pass
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Watchlist WebSocket error: {e}")
        manager.disconnect(websocket)


@router.get("/ws/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics."""
    return {
        "status": "active" if price_service.is_running else "inactive",
        **manager.get_stats(),
        "update_interval": price_service.update_interval,
    }
