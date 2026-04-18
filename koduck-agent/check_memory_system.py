#!/usr/bin/env python3
"""Memory System 诊断工具

检查 memory 系统是否正确配置和运行
"""

import asyncio
import os
import sys
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def get_db_url():
    """获取数据库 URL"""
    # 1. 首先检查环境变量
    url = os.getenv('DATABASE_URL') or os.getenv('MEMORY_DATABASE_URL')
    if url:
        return url

    # 2. 使用默认配置
    return "postgresql://koduck:koduck@localhost:5432/koduck_dev"


def check_imports():
    """检查模块导入"""
    print("=" * 60)
    print("1. 检查模块导入")
    print("=" * 60)
    
    try:
        from koduck.memory import (
            build_messages_with_memory,
            process_session_summary,
            ValueScorer,
            ContextInjector,
            MemoryPipeline
        )
        print("✓ Memory 模块导入成功")
        return True
    except ImportError as e:
        print(f"✗ Memory 模块导入失败: {e}")
        return False


def check_database():
    """检查数据库连接和表结构"""
    print("\n" + "=" * 60)
    print("2. 检查数据库连接和表结构")
    print("=" * 60)
    
    db_url = get_db_url()
    
    # 隐藏密码用于显示
    display_url = re.sub(r':([^:@]+)@', r':***@', db_url)
    print(f"✓ 数据库 URL: {display_url}")
    
    try:
        import asyncpg
        
        async def _check():
            conn = await asyncpg.connect(db_url)
            
            # 检查表是否存在
            tables = ['memory_l1_summaries', 'memory_l2_themes', 'memory_access_log']
            all_exist = True
            for table in tables:
                result = await conn.fetchval(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
                    table
                )
                status = "✓" if result else "✗"
                print(f"{status} 表 {table}: {'存在' if result else '不存在'}")
                if not result:
                    all_exist = False
            
            await conn.close()
            return all_exist
        
        return asyncio.run(_check())
        
    except ImportError:
        print("✗ asyncpg 未安装")
        return False
    except Exception as e:
        print(f"✗ 数据库连接失败: {e}")
        return False


def check_server_integration():
    """检查 Server 集成"""
    print("\n" + "=" * 60)
    print("3. 检查 Server 集成")
    print("=" * 60)
    
    try:
        # 只检查代码是否正确定义，不实际导入整个 server 模块
        with open('koduck/server.py', 'r') as f:
            server_code = f.read()
        
        checks = [
            ('MEMORY_SYSTEM_AVAILABLE', 'MEMORY_SYSTEM_AVAILABLE' in server_code),
            ('_get_db_pool', '_get_db_pool' in server_code),
            ('_generate_summary_async', '_generate_summary_async' in server_code),
            ('build_messages_with_memory', 'build_messages_with_memory' in server_code),
            ('auto_summarize', 'auto_summarize' in server_code),
        ]
        
        all_ok = True
        for name, exists in checks:
            status = "✓" if exists else "✗"
            print(f"{status} {name}: {'已定义' if exists else '未定义'}")
            if not exists:
                all_ok = False
        
        return all_ok
        
    except Exception as e:
        print(f"✗ Server 检查失败: {e}")
        return False


def test_value_scorer():
    """测试价值评分"""
    print("\n" + "=" * 60)
    print("4. 测试价值评分")
    print("=" * 60)
    
    try:
        from koduck.memory.core.value_scorer import ValueScorer
        
        scorer = ValueScorer()
        
        # 测试高价值内容
        high_value_text = "记住我喜欢用Python做后端开发，决定使用PostgreSQL数据库"
        dims = scorer.score(high_value_text)
        print(f"高价值文本: {high_value_text[:40]}...")
        print(f"  总分: {dims.total:.2f}")
        print(f"  importance: {dims.importance:.2f}")
        print(f"  是否应存储: {scorer.should_store(dims)}")
        print(f"  摘要类型: {scorer.get_summary_type(high_value_text, dims)}")
        
        # 测试低价值内容
        low_value_text = "你好，在吗？"
        dims2 = scorer.score(low_value_text)
        print(f"\n低价值文本: {low_value_text}")
        print(f"  总分: {dims2.total:.2f}")
        print(f"  是否应存储: {scorer.should_store(dims2)}")
        
        return True
        
    except Exception as e:
        print(f"✗ 价值评分测试失败: {e}")
        return False


async def test_memory_storage():
    """测试记忆存储"""
    print("\n" + "=" * 60)
    print("5. 测试记忆存储 (异步)")
    print("=" * 60)
    
    db_url = get_db_url()
    
    try:
        import asyncpg
        from koduck.memory.core.storage import MemoryStorage
        
        pool = await asyncpg.create_pool(db_url, min_size=1, max_size=2)
        storage = MemoryStorage(pool)
        
        # 测试获取用户统计
        stats = await storage.get_user_stats(1)
        print(f"✓ 数据库连接成功")
        print(f"✓ 用户 1 的记忆统计:")
        print(f"  总记忆数: {stats.get('total_memories', 0)}")
        print(f"  活跃记忆: {stats.get('active_memories', 0)}")
        print(f"  平均价值分: {stats.get('avg_score', 0):.2f}" if stats.get('avg_score') else "  平均价值分: N/A")
        print(f"  置顶记忆: {stats.get('pinned_count', 0)}")
        
        await pool.close()
        return True
        
    except Exception as e:
        print(f"✗ 记忆存储测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def show_environment():
    """显示环境变量"""
    print("\n" + "=" * 60)
    print("6. 环境变量配置")
    print("=" * 60)
    
    # 显示数据库 URL（脱敏）
    db_url = get_db_url()
    display_url = re.sub(r':([^:@]+)@', r':***@', db_url)
    print(f"DATABASE_URL: {display_url}")
    
    env_vars = [
        'MINIMAX_API_KEY',
        'OPENAI_API_KEY', 
        'LLM_API_KEY',
        'LOG_LEVEL'
    ]
    
    print("\n其他环境变量:")
    for var in env_vars:
        value = os.getenv(var)
        if value:
            display = value[:15] + "..." if len(value) > 15 else value
            print(f"  ✓ {var}: {display}")
        else:
            print(f"  ✗ {var}: 未设置")


def show_usage_guide():
    """显示使用指南"""
    print("\n" + "=" * 60)
    print("使用指南")
    print("=" * 60)
    
    print("\n1. 本地开发环境:")
    print("   # 方法 A: 直接设置环境变量")
    print("   export DATABASE_URL=postgresql://koduck:koduck@localhost:5432/koduck_dev")
    print("   cd koduck-agent && python3 -m koduck.server")
    
    print("\n2. 使用 .env 文件:")
    print("   echo 'DATABASE_URL=postgresql://koduck:koduck@localhost:5432/koduck_dev' > .env")
    print("   source .env && python3 -m koduck.server")
    
    print("\n3. Kubernetes 联调:")
    print("   ./k8s/deploy.sh dev install")
    print("   kubectl get pods -n koduck-dev")

    print("\n4. 验证 Memory 系统是否工作:")
    print("   a. 发送一条高价值消息（包含'决定'、'记住'等关键词）")
    print("   b. 检查日志中是否有 '[Memory] Context injected' 或 '[Memory] Summary generated'")
    print("   c. 查询数据库: SELECT * FROM memory_l1_summaries;")


def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("Memory System 诊断工具")
    print("=" * 60)
    
    results = []
    
    # 1. 检查导入
    results.append(("模块导入", check_imports()))
    
    # 2. 检查数据库
    results.append(("数据库", check_database()))
    
    # 3. 检查 Server 集成
    results.append(("Server 集成", check_server_integration()))
    
    # 4. 测试价值评分
    results.append(("价值评分", test_value_scorer()))
    
    # 5. 测试记忆存储
    try:
        storage_result = asyncio.run(test_memory_storage())
        results.append(("记忆存储", storage_result))
    except Exception as e:
        print(f"\n记忆存储测试失败: {e}")
        results.append(("记忆存储", False))
    
    # 6. 显示环境变量
    show_environment()
    
    # 总结
    print("\n" + "=" * 60)
    print("诊断结果汇总")
    print("=" * 60)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status} - {name}")
    
    all_passed = all(r for _, r in results)
    
    if all_passed:
        print("\n✓ 所有检查通过！Memory 系统已就绪")
    else:
        print("\n✗ 部分检查失败，请根据上面的错误信息进行修复")
    
    # 显示使用指南
    show_usage_guide()
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
