#!/usr/bin/env python3
"""Memory System 定时任务

用于批量处理、清理、统计等
"""

import asyncio
import argparse
from datetime import datetime, timedelta
from typing import Optional

import asyncpg


class MemoryTasks:
    """记忆系统定时任务"""
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.db_pool = None
    
    async def init(self):
        """初始化数据库连接"""
        self.db_pool = await asyncpg.create_pool(self.db_url)
    
    async def close(self):
        """关闭连接"""
        if self.db_pool:
            await self.db_pool.close()
    
    # ==================== 批量摘要任务 ====================
    
    async def batch_summarize(
        self,
        user_id: Optional[int] = None,
        days_back: int = 7,
        min_messages: int = 4,
        dry_run: bool = False
    ):
        """
        批量为历史会话生成摘要
        
        Args:
            user_id: 指定用户，None则为所有用户
            days_back: 处理最近几天的会话
            min_messages: 最少消息数
            dry_run: 是否只预览不执行
        """
        print(f"[Batch Summarize] Processing sessions from last {days_back} days")
        
        # 查询需要处理的会话
        sql = """
        SELECT 
            user_id,
            session_id,
            COUNT(*) as msg_count
        FROM chat_messages
        WHERE created_at > NOW() - INTERVAL '%s days'
          AND (%s IS NULL OR user_id = %s)
          AND (has_summary = false OR has_summary IS NULL)
        GROUP BY user_id, session_id
        HAVING COUNT(*) >= %s
        ORDER BY MIN(created_at) DESC
        LIMIT 100
        """
        
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(sql, days_back, user_id, user_id, min_messages)
        
        print(f"[Batch Summarize] Found {len(rows)} sessions to process")
        
        if dry_run:
            for row in rows:
                print(f"  - User {row['user_id']}, Session {row['session_id']}: {row['msg_count']} messages")
            return
        
        # 处理每个会话
        processed = 0
        skipped = 0
        failed = 0
        
        from koduck.memory.pipeline import MemoryPipeline
        pipeline = MemoryPipeline(self.db_pool)
        
        for row in rows:
            try:
                # 获取消息
                messages = await self._get_session_messages(
                    row['user_id'], 
                    row['session_id']
                )
                
                # 生成摘要
                result = await pipeline.process_session(
                    user_id=row['user_id'],
                    session_id=row['session_id'],
                    messages=messages
                )
                
                if result['status'] == 'success':
                    processed += 1
                    print(f"  ✓ {row['session_id']}: score={result['value_score']:.2f}")
                elif result['status'] == 'filtered':
                    skipped += 1
                    print(f"  ⚠ {row['session_id']}: filtered (score={result.get('score', 0):.2f})")
                else:
                    failed += 1
                    print(f"  ✗ {row['session_id']}: {result.get('reason')}")
                    
            except Exception as e:
                failed += 1
                print(f"  ✗ {row['session_id']}: error={e}")
        
        print(f"\n[Batch Summarize] Complete: {processed} processed, {skipped} skipped, {failed} failed")
    
    async def _get_session_messages(self, user_id: int, session_id: str) -> list:
        """获取会话消息"""
        sql = """
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE user_id = %s AND session_id = %s
        ORDER BY created_at ASC
        """
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(sql, user_id, session_id)
            return [dict(r) for r in rows]
    
    # ==================== 清理任务 ====================
    
    async def cleanup_expired(
        self,
        user_id: Optional[int] = None,
        dry_run: bool = False
    ):
        """清理过期记忆"""
        print("[Cleanup] Starting expired memory cleanup")
        
        # 查询即将过期的（用于日志）
        preview_sql = """
        SELECT 
            user_id,
            COUNT(*) as expired_count
        FROM memory_l1_summaries
        WHERE status = 'active'
          AND is_pinned = false
          AND expires_at < NOW()
          AND (%s IS NULL OR user_id = %s)
        GROUP BY user_id
        """
        
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(preview_sql, user_id, user_id)
        
        total_expired = sum(r['expired_count'] for r in rows)
        print(f"[Cleanup] Found {total_expired} expired memories")
        
        for row in rows:
            print(f"  - User {row['user_id']}: {row['expired_count']} memories")
        
        if dry_run:
            return
        
        # 执行清理
        cleanup_sql = """
        UPDATE memory_l1_summaries
        SET status = 'archived'
        WHERE status = 'active'
          AND is_pinned = false
          AND expires_at < NOW()
          AND (%s IS NULL OR user_id = %s)
        """
        
        async with self.db_pool.acquire() as conn:
            result = await conn.execute(cleanup_sql, user_id, user_id)
            count = int(result.split()[1]) if result else 0
        
        print(f"[Cleanup] Archived {count} memories")
    
    # ==================== 统计任务 ====================
    
    async def generate_stats(self):
        """生成统计报告"""
        print("[Stats] Generating memory statistics")
        
        stats_sql = """
        SELECT 
            (SELECT COUNT(*) FROM memory_l1_summaries WHERE status = 'active') as total_active,
            (SELECT COUNT(*) FROM memory_l1_summaries WHERE status = 'archived') as total_archived,
            (SELECT AVG(value_score) FROM memory_l1_summaries WHERE status = 'active') as avg_score,
            (SELECT COUNT(*) FROM memory_l1_summaries WHERE is_pinned) as pinned_count,
            (SELECT COUNT(DISTINCT user_id) FROM memory_l1_summaries) as active_users
        """
        
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(stats_sql)
        
        print("\n========== Memory Statistics ==========")
        print(f"Active Memories:    {row['total_active']}")
        print(f"Archived Memories:  {row['total_archived']}")
        print(f"Average Score:      {row['avg_score']:.2f}" if row['avg_score'] else "N/A")
        print(f"Pinned Memories:    {row['pinned_count']}")
        print(f"Active Users:       {row['active_users']}")
        print("=======================================\n")
        
        # 按用户统计
        user_stats_sql = """
        SELECT 
            user_id,
            COUNT(*) as memory_count,
            AVG(value_score) as avg_score,
            COUNT(*) FILTER (WHERE is_pinned) as pinned_count
        FROM memory_l1_summaries
        WHERE status = 'active'
        GROUP BY user_id
        ORDER BY memory_count DESC
        LIMIT 10
        """
        
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(user_stats_sql)
        
        if rows:
            print("Top Users by Memory Count:")
            for row in rows:
                print(f"  User {row['user_id']}: {row['memory_count']} memories, "
                      f"avg_score={row['avg_score']:.2f}, pinned={row['pinned_count']}")
    
    # ==================== 重建主题 ====================
    
    async def rebuild_themes(self, user_id: Optional[int] = None):
        """重建主题聚合"""
        print("[Themes] Rebuilding theme aggregation")
        
        # 获取所有摘要
        sql = """
        SELECT id, user_id, summary, extracted_entities
        FROM memory_l1_summaries
        WHERE status = 'active'
          AND (%s IS NULL OR user_id = %s)
        ORDER BY user_id, created_at DESC
        """
        
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(sql, user_id, user_id)
        
        print(f"[Themes] Processing {len(rows)} summaries")
        
        # 清空现有主题
        if user_id:
            await conn.execute(
                "DELETE FROM memory_l2_themes WHERE user_id = %s",
                user_id
            )
        else:
            await conn.execute("DELETE FROM memory_l2_themes")
        
        # 重新聚合
        from koduck.memory.core.storage import MemoryStorage
        storage = MemoryStorage(self.db_pool)
        
        processed = 0
        for row in rows:
            try:
                # 提取关键词
                entities = row['extracted_entities'] or []
                keywords = self._extract_keywords(row['summary'], entities)
                
                if keywords:
                    main_theme = keywords[0].replace(' ', '_').lower()[:30]
                    
                    await storage.upsert_theme(
                        user_id=row['user_id'],
                        theme_name=main_theme,
                        summary_id=str(row['id']),
                        keywords=keywords,
                        summary_text=row['summary']
                    )
                    processed += 1
                    
            except Exception as e:
                print(f"  ✗ Error processing summary {row['id']}: {e}")
        
        print(f"[Themes] Rebuilt {processed} themes")
    
    def _extract_keywords(self, summary: str, entities: list) -> list:
        """提取关键词"""
        import re
        keywords = []
        
        # 从实体中提取
        for entity in entities:
            if entity.get('key'):
                keywords.append(entity['key'])
        
        # 从摘要中提取
        chinese_words = re.findall(r'[\u4e00-\u9fff]{2,6}', summary)
        english_words = re.findall(r'[a-zA-Z_]{3,20}', summary.lower())
        
        keywords.extend(chinese_words)
        keywords.extend(english_words)
        
        # 去重
        seen = set()
        unique = []
        for kw in keywords:
            if kw.lower() not in seen and len(kw) >= 2:
                seen.add(kw.lower())
                unique.append(kw)
        
        return unique[:10]


# ==================== CLI 入口 ====================

async def main():
    parser = argparse.ArgumentParser(description='Memory System Tasks')
    parser.add_argument('--db-url', required=True, help='Database URL')
    parser.add_argument('--dry-run', action='store_true', help='Preview only')
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # batch-summarize 命令
    summarize_parser = subparsers.add_parser('batch-summarize', help='Batch generate summaries')
    summarize_parser.add_argument('--user-id', type=int, help='Specific user ID')
    summarize_parser.add_argument('--days', type=int, default=7, help='Days back')
    summarize_parser.add_argument('--min-messages', type=int, default=4, help='Min message count')
    
    # cleanup 命令
    cleanup_parser = subparsers.add_parser('cleanup', help='Cleanup expired memories')
    cleanup_parser.add_argument('--user-id', type=int, help='Specific user ID')
    
    # stats 命令
    subparsers.add_parser('stats', help='Generate statistics')
    
    # rebuild-themes 命令
    themes_parser = subparsers.add_parser('rebuild-themes', help='Rebuild theme aggregation')
    themes_parser.add_argument('--user-id', type=int, help='Specific user ID')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # 初始化
    tasks = MemoryTasks(args.db_url)
    await tasks.init()
    
    try:
        if args.command == 'batch-summarize':
            await tasks.batch_summarize(
                user_id=args.user_id,
                days_back=args.days,
                min_messages=args.min_messages,
                dry_run=args.dry_run
            )
        
        elif args.command == 'cleanup':
            await tasks.cleanup_expired(
                user_id=args.user_id,
                dry_run=args.dry_run
            )
        
        elif args.command == 'stats':
            await tasks.generate_stats()
        
        elif args.command == 'rebuild-themes':
            await tasks.rebuild_themes(user_id=args.user_id)
    
    finally:
        await tasks.close()


if __name__ == '__main__':
    asyncio.run(main())
