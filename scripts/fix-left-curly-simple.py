#!/usr/bin/env python3
"""
简单修复左花括号位置
"""

import re
import sys


def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # 修复：\n{ 改为在行尾
    # 1. 类声明
    content = re.sub(
        r'^(public\s+|final\s+|abstract\s+)?(class|interface|enum|record)\s+(\w+)(<[^>]+>)?(\s+extends\s+[\w<>,\s]+)?(\s+implements\s+[\w<>,\s]+)?\s*\n\s*\{',
        lambda m: m.group(0).split('\n')[0].rstrip() + ' {',
        content, flags=re.MULTILINE
    )
    
    # 2. 方法 - 小心处理，只修复独占一行的情况
    # 匹配方法签名（可能带泛型）后跟着换行和单独的 {
    content = re.sub(
        r'^((?:\s+)(?:public|private|protected|static|final|abstract|synchronized|\s)*<[^>]+>\s+[\w<>,\s\[\]]+\s+\w+\s*\([^)]*\))\s*\n\s*\{',
        lambda m: m.group(1).rstrip() + ' {',
        content, flags=re.MULTILINE
    )
    content = re.sub(
        r'^((?:\s+)(?:public|private|protected|static|final|abstract|synchronized|\s)+[\w<>,\s\[\]]+\s+\w+\s*\([^)]*\))\s*\n\s*\{',
        lambda m: m.group(1).rstrip() + ' {',
        content, flags=re.MULTILINE
    )
    
    # 3. 控制语句
    patterns = [
        (r'(if\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(else\s+if\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(?<![\w])else\s*\n\s*\{', r'else {'),
        (r'(for\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(while\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(?<![\w])do\s*\n\s*\{', r'do {'),
        (r'(?<![\w])try\s*\n\s*\{', r'try {'),
        (r'(catch\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(?<![\w])finally\s*\n\s*\{', r'finally {'),
        (r'(switch\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
    ]
    
    for pattern, repl in patterns:
        content = re.sub(pattern, repl, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: {filepath}")
        return True
    return False


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix-left-curly-simple.py <file.java>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    fix_file(filepath)
