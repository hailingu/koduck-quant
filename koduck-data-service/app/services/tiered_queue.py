"""Priority queue for tiered watchlist updates.

Provides a priority-based task queue for handling different update frequencies
across track and watch layers.
"""

import asyncio
import logging
from typing import Callable, Dict, List, Optional, Any
from dataclasses import dataclass, field
from heapq import heappush, heappop
from datetime import datetime

from app.models.tiered_watchlist import Priority, UpdateTask

logger = logging.getLogger(__name__)


@dataclass(order=True)
class QueuedTask:
    """Internal queued task with priority ordering."""
    priority: int
    created_at: datetime = field(compare=False)
    task: UpdateTask = field(compare=False)
    task_id: str = field(compare=False)


class TieredPriorityQueue:
    """Priority queue for tiered watchlist update tasks.
    
    Handles task prioritization:
    - Priority 0 (TRACK_REALTIME): Immediate execution
    - Priority 1-4: Queued execution with priority ordering
    """
    
    def __init__(self):
        self._queue: List[QueuedTask] = []
        self._task_map: Dict[str, QueuedTask] = {}
        self._lock = asyncio.Lock()
        self._counter = 0
        self._stats = {
            "total_enqueued": 0,
            "total_processed": 0,
            "dropped_duplicates": 0,
        }
    
    def _generate_task_id(self) -> str:
        """Generate unique task ID."""
        self._counter += 1
        return f"task_{datetime.now().strftime('%Y%m%d%H%M%S')}_{self._counter}"
    
    async def enqueue(self, task: UpdateTask) -> str:
        """Add task to queue.
        
        Args:
            task: Update task to enqueue
            
        Returns:
            Task ID
        """
        async with self._lock:
            task_id = self._generate_task_id()
            
            # Check for duplicate symbols with same priority
            existing_key = f"{task.priority}:{','.join(sorted(task.symbols))}"
            if existing_key in self._task_map:
                logger.debug(f"Duplicate task dropped: {existing_key}")
                self._stats["dropped_duplicates"] += 1
                return self._task_map[existing_key].task_id
            
            queued_task = QueuedTask(
                priority=task.priority.value,
                created_at=task.created_at,
                task=task,
                task_id=task_id
            )
            
            heappush(self._queue, queued_task)
            self._task_map[existing_key] = queued_task
            self._stats["total_enqueued"] += 1
            
            logger.debug(f"Enqueued task {task_id}: priority={task.priority.name}, "
                        f"symbols={len(task.symbols)}, type={task.task_type}")
            return task_id
    
    async def dequeue(self) -> Optional[UpdateTask]:
        """Get highest priority task from queue.
        
        Returns:
            Update task or None if queue is empty
        """
        async with self._lock:
            if not self._queue:
                return None
            
            queued_task = heappop(self._queue)
            
            # Remove from task map
            task_key = f"{queued_task.task.priority.value}:{','.join(sorted(queued_task.task.symbols))}"
            self._task_map.pop(task_key, None)
            
            self._stats["total_processed"] += 1
            
            logger.debug(f"Dequeued task {queued_task.task_id}: "
                        f"priority={queued_task.task.priority.name}")
            return queued_task.task
    
    async def peek(self) -> Optional[UpdateTask]:
        """Peek at highest priority task without removing.
        
        Returns:
            Update task or None if queue is empty
        """
        async with self._lock:
            if not self._queue:
                return None
            return self._queue[0].task
    
    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics.
        
        Returns:
            Queue statistics dictionary
        """
        async with self._lock:
            priority_counts = {}
            for queued_task in self._queue:
                priority_name = Priority(queued_task.priority).name
                priority_counts[priority_name] = priority_counts.get(priority_name, 0) + 1
            
            return {
                "queue_length": len(self._queue),
                "priority_breakdown": priority_counts,
                **self._stats
            }
    
    async def clear(self):
        """Clear all tasks from queue."""
        async with self._lock:
            self._queue.clear()
            self._task_map.clear()
            logger.info("Queue cleared")
    
    def is_empty(self) -> bool:
        """Check if queue is empty.
        
        Returns:
            True if queue is empty
        """
        return len(self._queue) == 0
    
    def size(self) -> int:
        """Get queue size.
        
        Returns:
            Number of tasks in queue
        """
        return len(self._queue)


class TieredUpdateWorker:
    """Worker for processing tiered update tasks.
    
    Continuously processes tasks from the priority queue with
    configurable concurrency and rate limiting.
    """
    
    def __init__(
        self,
        queue: TieredPriorityQueue,
        max_concurrent: int = 5,
        rate_limit_per_second: int = 10
    ):
        self.queue = queue
        self.max_concurrent = max_concurrent
        self.rate_limit = rate_limit_per_second
        self._handlers: Dict[str, Callable] = {}
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._stats = {
            "tasks_processed": 0,
            "tasks_failed": 0,
            "tasks_by_type": {},
        }
        logger.info(f"TieredUpdateWorker initialized: max_concurrent={max_concurrent}, "
                   f"rate_limit={rate_limit_per_second}/s")
    
    def register_handler(self, task_type: str, handler: Callable):
        """Register handler for task type.
        
        Args:
            task_type: Task type identifier
            handler: Async function to handle task
        """
        self._handlers[task_type] = handler
        logger.info(f"Registered handler for task type: {task_type}")
    
    async def start(self):
        """Start the worker."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._worker_loop())
        logger.info("TieredUpdateWorker started")
    
    async def stop(self):
        """Stop the worker."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("TieredUpdateWorker stopped")
    
    async def _worker_loop(self):
        """Main worker loop."""
        while self._running:
            try:
                # Rate limiting
                await asyncio.sleep(1.0 / self.rate_limit)
                
                # Get task from queue
                task = await self.queue.dequeue()
                if task is None:
                    await asyncio.sleep(0.1)  # Short sleep if queue empty
                    continue
                
                # Process task with semaphore
                async with self._semaphore:
                    asyncio.create_task(self._process_task(task))
                    
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                await asyncio.sleep(1)
    
    async def _process_task(self, task: UpdateTask):
        """Process a single task.
        
        Args:
            task: Task to process
        """
        try:
            handler = self._handlers.get(task.task_type)
            if handler is None:
                logger.warning(f"No handler for task type: {task.task_type}")
                return
            
            logger.debug(f"Processing task: {task.task_type}, priority={task.priority.name}")
            await handler(task.symbols)
            
            self._stats["tasks_processed"] += 1
            self._stats["tasks_by_type"][task.task_type] = \
                self._stats["tasks_by_type"].get(task.task_type, 0) + 1
                
        except Exception as e:
            logger.error(f"Task processing failed: {e}")
            self._stats["tasks_failed"] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get worker statistics.
        
        Returns:
            Worker statistics
        """
        return {
            **self._stats,
            "running": self._running,
            "max_concurrent": self.max_concurrent,
            "rate_limit": self.rate_limit,
        }


# Global queue instance
tiered_queue = TieredPriorityQueue()
