# Stock Basic 表结构增强

## 概述

本次更新对 `stock_basic` 表进行了全面增强，添加了更多维度的股票基本信息，以支持更丰富的股票搜索、筛选和分析功能。

## 数据库变更

### 新增字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `full_name` | VARCHAR(200) | 公司全称 |
| `short_name` | VARCHAR(50) | 股票简称（备用） |
| `industry` | VARCHAR(100) | 所属行业（证监会行业分类） |
| `sector` | VARCHAR(100) | 所属板块/概念 |
| `sub_industry` | VARCHAR(100) | 子行业 |
| `province` | VARCHAR(50) | 所属省份 |
| `city` | VARCHAR(50) | 所属城市 |
| `total_shares` | BIGINT | 总股本（万股） |
| `float_shares` | BIGINT | 流通股本（万股） |
| `float_ratio` | DECIMAL(5,4) | 流通比例 |
| `status` | VARCHAR(20) | 上市状态 |
| `is_shanghai_hongkong` | BOOLEAN | 是否沪港通标的 |
| `is_shenzhen_hongkong` | BOOLEAN | 是否深港通标的 |
| `stock_type` | VARCHAR(20) | 股票类型 |
| **估值指标** | | |
| `pe_ttm` | DECIMAL(12,4) | 市盈率（TTM，滚动12个月） |
| `pb` | DECIMAL(12,4) | 市净率 |
| `ps_ttm` | DECIMAL(12,4) | 市销率（TTM） |
| `market_cap` | DECIMAL(18,2) | 总市值（亿元） |
| `float_market_cap` | DECIMAL(18,2) | 流通市值（亿元） |

### 状态说明

`status` 字段的可能值：
- `Active` - 正常交易
- `Suspended` - 停牌
- `ST` - 特别处理
- `*ST` - 退市风险警示
- `Delisted` - 已退市

## 使用方法

### 1. 应用数据库迁移

后端服务（Flyway）会自动应用 V16 迁移。

### 2. 运行数据增强脚本

```bash
cd koduck-data-service

# 更新所有股票
python -m app.scripts.enhance_stock_basic

# 更新单只股票
python -m app.scripts.enhance_stock_basic --symbol 601012
```

### 3. 查询示例

```sql
-- 按行业查询
SELECT symbol, name, industry, sector
FROM stock_basic
WHERE industry = '电力设备'
LIMIT 10;

-- 按地区查询
SELECT symbol, name, province, city
FROM stock_basic
WHERE province = '广东省'
ORDER BY float_shares DESC;

-- 查询大盘蓝筹股
SELECT symbol, name, float_shares/10000 as float_shares_wan
FROM stock_basic
WHERE float_shares > 100000
ORDER BY float_shares DESC;

-- 低估值筛选（PE < 10, PB < 1）
SELECT symbol, name, pe_ttm, pb, market_cap
FROM stock_basic
WHERE pe_ttm > 0 AND pe_ttm < 10
  AND pb > 0 AND pb < 1
  AND status = 'Active'
ORDER BY pe_ttm ASC;

-- 行业估值对比
SELECT industry, 
       ROUND(AVG(pe_ttm)::numeric, 2) as avg_pe, 
       ROUND(AVG(pb)::numeric, 2) as avg_pb,
       COUNT(*) as stock_count
FROM stock_basic
WHERE status = 'Active' 
  AND pe_ttm > 0 
  AND industry IS NOT NULL
GROUP BY industry
ORDER BY avg_pe;
```

## 文件变更

- `koduck-backend/src/main/resources/db/migration/V16__enhance_stock_basic.sql` - 数据库迁移
- `koduck-data-service/app/db.py` - 数据库操作层
- `koduck-data-service/app/services/stock_initializer.py` - 股票初始化
- `koduck-data-service/app/scripts/enhance_stock_basic.py` - 数据增强脚本
