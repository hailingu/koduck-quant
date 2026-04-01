#!/bin/bash
# Memory System 环境配置脚本

echo "Memory System 环境配置"
echo "======================"
echo ""

# 检查 .env 文件
if [ -f ".env" ]; then
    echo "发现 .env 文件，加载环境变量..."
    source .env
fi

# 设置默认值
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-koduck}
DB_USER=${POSTGRES_USER:-koduck}
DB_PASS=${POSTGRES_PASSWORD:-koduck}

# 构建 DATABASE_URL
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
export MEMORY_DATABASE_URL="${DATABASE_URL}"

echo "数据库配置:"
echo "  HOST: ${DB_HOST}"
echo "  PORT: ${DB_PORT}"
echo "  DB:   ${DB_NAME}"
echo "  USER: ${DB_USER}"
echo ""

# 检查数据库连接
echo "检查数据库连接..."
if command -v psql &> /dev/null; then
    if psql "${DATABASE_URL}" -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✓ 数据库连接成功"
    else
        echo "✗ 数据库连接失败，请检查配置"
        exit 1
    fi
else
    echo "⚠ psql 未安装，跳过连接检查"
fi

echo ""
echo "创建 memory 系统表..."
if psql "${DATABASE_URL}" -f ../init-db/004_memory_v2.sql; then
    echo "✓ 表创建成功"
else
    echo "✗ 表创建失败"
    exit 1
fi

echo ""
echo "验证安装..."
python3 check_memory_system.py

echo ""
echo "======================"
echo "配置完成！"
echo ""
echo "现在可以启动 server:"
echo "  cd koduck-agent && python3 -m koduck.server"
