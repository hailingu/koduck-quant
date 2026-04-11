# Memory System 设置检查清单

## 实施步骤

### Step 1: 数据库设置

- [ ] 1.1 执行数据库 migration
```bash
cd /Users/guhailin/Git/koduck-quant
psql $DATABASE_URL -f init-db/03-memory-v2.sql
```

- [ ] 1.2 验证表创建
```sql
\dt memory_l1_summaries
\dt memory_l2_themes
\dt memory_access_log
```

- [ ] 1.3 验证索引创建
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('memory_l1_summaries', 'memory_l2_themes');
```

### Step 2: Python 依赖

- [ ] 2.1 确保安装了 asyncpg
```bash
pip install asyncpg
```

- [ ] 2.2 验证 koduck-agent 目录结构
```
koduck-agent/koduck/memory/
├── __init__.py
├── context_injector.py
├── pipeline.py
├── server_integration.py
├── core/
│   ├── __init__.py
│   ├── value_scorer.py
│   ├── summarizer.py
│   ├── entity_extractor.py
│   └── storage.py
└── api/
    └── routes.py
```

### Step 3: 环境变量配置

- [ ] 3.1 确保数据库连接配置
```bash
export DATABASE_URL="postgresql://user:pass@localhost/koduck"
# 或
export MEMORY_DATABASE_URL="postgresql://..."
```

- [ ] 3.2 LLM API 配置 (用于摘要生成)
```bash
export MINIMAX_API_KEY="your_key"
# 或
export OPENAI_API_KEY="your_key"
```

### Step 4: Server 集成

- [ ] 4.1 修改 `koduck/server.py`，添加初始化
```python
from koduck.memory.server_integration import init_memory_integration

@app.on_event("startup")
async def startup():
    # 初始化记忆系统
    init_memory_integration(db_pool, enabled=True)
```

- [ ] 4.2 修改 `simple_chat` 函数
```python
from koduck.memory.server_integration import inject_context_to_messages

@app.post("/api/v1/ai/chat")
async def simple_chat(request: SimpleChatRequest):
    # ... 原有代码 ...
    
    # 注入历史记忆上下文
    memory_options = (request.runtimeOptions or {}).get("memory", {})
    if memory_options.get("retrieve_context", True):
        messages = await inject_context_to_messages(
            user_id=user_id,
            session_id=session_id,
            messages=messages
        )
    
    # ... LLM 处理 ...
```

### Step 5: 测试验证

- [ ] 5.1 运行单元测试
```bash
cd koduck-agent
python -c "from koduck.memory import ValueScorer; scorer = ValueScorer(); print('ValueScorer OK')"
python -c "from koduck.memory import ContextInjector; print('ContextInjector OK')"
python -c "from koduck.memory import MemoryPipeline; print('MemoryPipeline OK')"
```

- [ ] 5.2 测试价值评分
```python
from koduck.memory.core.value_scorer import quick_score
result = quick_score("记住我喜欢用Python")
print(f"Score: {result}")
```

- [ ] 5.3 测试上下文注入 (手动)
```python
import asyncio
from koduck.memory import inject_memory_context

async def test():
    result = await inject_memory_context(
        user_id=1,
        query="JWT 认证",
        db_pool=db_pool
    )
    print(result)

asyncio.run(test())
```

### Step 6: API 端点 (可选)

- [ ] 6.1 添加 API 路由
```python
from koduck.memory.api.routes import init_memory_routes

# 在 app 初始化后
init_memory_routes(app, db_pool, get_current_user_id)
```

- [ ] 6.2 测试 API
```bash
# 生成摘要
curl -X POST http://localhost:8000/api/v1/memory/summarize \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess_123"}'

# 获取统计
curl http://localhost:8000/api/v1/memory/stats
```

### Step 7: 定时任务设置

- [ ] 7.1 设置定时清理任务
```bash
# 每天凌晨2点清理过期记忆
0 2 * * * cd /Users/guhailin/Git/koduck-quant && \
  python koduck-agent/scripts/memory_tasks.py \
  --db-url "$DATABASE_URL" cleanup
```

- [ ] 7.2 设置定时统计
```bash
# 每周一早上9点生成统计报告
0 9 * * 1 cd /Users/guhailin/Git/koduck-quant && \
  python koduck-agent/scripts/memory_tasks.py \
  --db-url "$DATABASE_URL" stats
```

## 验证清单

### 功能验证

- [ ] 新会话生成摘要正常
- [ ] 高价值摘要自动注入上下文
- [ ] 用户可以编辑摘要
- [ ] 用户可以置顶/取消置顶
- [ ] 检索结果按相关性排序
- [ ] Token预算控制生效

### 性能验证

- [ ] 摘要生成延迟 < 3s
- [ ] 检索延迟 P99 < 100ms
- [ ] 存储增长率下降

### 监控检查

- [ ] 日志输出正常
- [ ] 错误处理正常
- [ ] 回滚机制可用

## 回滚方案

如果出现问题，快速回滚步骤：

1. **关闭上下文注入**
   ```python
   # server.py 中设置
   init_memory_integration(db_pool, enabled=False)
   ```

2. **回滚代码**
   ```bash
   git checkout -- koduck/server.py
   ```

3. **保留数据** (不清空表，用于分析)
   ```sql
   -- 只禁用新功能，保留数据
   ALTER TABLE memory_l1_summaries DISABLE TRIGGER ALL;
   ```

## 故障排查

### 问题1: "表不存在"
**解决**: 重新执行 migration
```bash
psql $DATABASE_URL -f init-db/03-memory-v2.sql
```

### 问题2: "导入错误"
**解决**: 检查 PYTHONPATH
```bash
cd koduck-agent
python -c "import koduck.memory; print('OK')"
```

### 问题3: "摘要未生成"
**解决**: 检查 LLM API 配置和日志
```bash
export LOG_LEVEL=DEBUG
```

### 问题4: "上下文未注入"
**解决**: 检查是否有高价值记忆
```sql
SELECT * FROM memory_l1_summaries 
WHERE user_id = 1 
ORDER BY value_score DESC LIMIT 5;
```

## 完成标志

- [ ] 数据库表创建完成
- [ ] Python 模块导入正常
- [ ] Server 集成完成
- [ ] 上下文注入功能正常
- [ ] 至少一个会话生成了摘要
- [ ] 定时任务配置完成

**完成日期**: ___________
**负责人**: ___________
