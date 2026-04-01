#!/bin/bash
# Phase 2 并行开发启动脚本

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                    Phase 2 并行开发环境启动器                              ║"
echo "╠════════════════════════════════════════════════════════════════════════════╣"
echo ""
echo "启动3个终端窗口，分别处理："
echo "  1. P2-01 JaCoCo 覆盖率门禁 (worktree-p2-01-jacoco)"
echo "  2. P2-03 模块边界梳理 (worktree-p2-03-arch)"
echo "  3. P2-04 PMD 治理 (worktree-p2-04-pmd)"
echo ""

# 获取项目根目录
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 检查 worktree 是否存在
if [ ! -d "$ROOT_DIR/../worktree-p2-01-jacoco" ]; then
    echo "❌ 错误: worktree 目录不存在"
    echo "请先运行初始化命令"
    exit 1
fi

# 根据终端类型启动
if command -v osascript &> /dev/null; then
    # macOS - 使用 AppleScript
    
    # 终端1: JaCoCo
    osascript <<END
        tell application "Terminal"
            do script "cd $ROOT_DIR/../worktree-p2-01-jacoco && clear && echo '🟢 P2-01: JaCoCo 覆盖率门禁' && echo '' && cat TASK_GUIDE.md | head -20 && exec bash"
            set custom title of front window to "P2-01 JaCoCo"
        end tell
END
    
    sleep 0.5
    
    # 终端2: 模块边界
    osascript <<END
        tell application "Terminal"
            do script "cd $ROOT_DIR/../worktree-p2-03-arch && clear && echo '🟢 P2-03: 模块边界梳理' && echo '' && cat TASK_GUIDE.md | head -20 && exec bash"
            set custom title of front window to "P2-03 Arch"
        end tell
END
    
    sleep 0.5
    
    # 终端3: PMD治理
    osascript <<END
        tell application "Terminal"
            do script "cd $ROOT_DIR/../worktree-p2-04-pmd && clear && echo '🟢 P2-04: PMD 治理' && echo '' && cat TASK_GUIDE.md | head -20 && exec bash"
            set custom title of front window to "P2-04 PMD"
        end tell
END
    
    echo "✅ 已启动 3 个终端窗口"
    
elif command -v gnome-terminal &> /dev/null; then
    # Linux - GNOME Terminal
    gnome-terminal --title="P2-01 JaCoCo" -- bash -c "cd $ROOT_DIR/../worktree-p2-01-jacoco && clear && echo '🟢 P2-01: JaCoCo 覆盖率门禁' && echo '' && cat TASK_GUIDE.md | head -20 && exec bash" &
    gnome-terminal --title="P2-03 Arch" -- bash -c "cd $ROOT_DIR/../worktree-p2-03-arch && clear && echo '🟢 P2-03: 模块边界梳理' && echo '' && cat TASK_GUIDE.md | head -20 && exec bash" &
    gnome-terminal --title="P2-04 PMD" -- bash -c "cd $ROOT_DIR/../worktree-p2-04-pmd && clear && echo '🟢 P2-04: PMD 治理' && echo '' && cat TASK_GUIDE.md | head -20 && exec bash" &
    echo "✅ 已启动 3 个终端窗口"
    
else
    # 通用方式 - 打印命令
    echo "请手动打开3个终端，分别执行："
    echo ""
    echo "【终端 1】P2-01 JaCoCo:"
    echo "  cd $ROOT_DIR/../worktree-p2-01-jacoco"
    echo ""
    echo "【终端 2】P2-03 模块边界:"
    echo "  cd $ROOT_DIR/../worktree-p2-03-arch"
    echo ""
    echo "【终端 3】P2-04 PMD治理:"
    echo "  cd $ROOT_DIR/../worktree-p2-04-pmd"
    echo ""
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo "开发指南文件位于各 worktree 目录的 TASK_GUIDE.md"
echo "════════════════════════════════════════════════════════════════════════════"
