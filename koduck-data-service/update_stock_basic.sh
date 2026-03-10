#!/bin/bash
# Script to update stock_basic table with enhanced fields

set -e

echo "=============================================="
echo "Stock Basic Table Enhancement Script"
echo "=============================================="

# Check if running in Docker or locally
if [ -f "/.dockerenv" ]; then
    echo "Running inside Docker container"
    DB_HOST="${POSTGRES_HOST:-postgresql}"
else
    echo "Running locally"
    DB_HOST="${POSTGRES_HOST:-localhost}"
fi

echo ""
echo "Step 1: Applying database migration..."
echo "----------------------------------------------"
echo "Migration file: V16__enhance_stock_basic.sql"
echo ""
echo "This migration adds the following fields:"
echo "  - full_name: 公司全称"
echo "  - short_name: 股票简称"
echo "  - industry: 所属行业"
echo "  - sector: 所属板块"
echo "  - sub_industry: 子行业"
echo "  - province: 所属省份"
echo "  - city: 所属城市"
echo "  - total_shares: 总股本（万股）"
echo "  - float_shares: 流通股本（万股）"
echo "  - float_ratio: 流通比例"
echo "  - status: 上市状态"
echo "  - is_shanghai_hongkong: 是否沪港通"
echo "  - is_shenzhen_hongkong: 是否深港通"
echo "  - stock_type: 股票类型"
echo ""
echo "Note: This migration should be applied by the Backend service (Flyway)."
echo "Please ensure the backend is running and has applied V16 migration."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "Step 2: Enhancing stock data..."
echo "----------------------------------------------"
# Activate virtual environment if exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "Running enhance_stock_basic.py..."
python -m app.scripts.enhance_stock_basic

echo ""
echo "=============================================="
echo "Stock Basic Enhancement Complete!"
echo "=============================================="
echo ""
echo "You can now query enhanced stock information:"
echo "  SELECT symbol, name, industry, sector, province, status"
echo "  FROM stock_basic"
echo "  WHERE status = 'Active';"
echo ""
