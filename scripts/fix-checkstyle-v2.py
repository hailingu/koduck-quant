#!/usr/bin/env python3
"""
批量修复 koduck-backend 的 checkstyle 告警 - 版本2
修复：更精确地处理左花括号
"""

import re
import os
import sys
from pathlib import Path


def fix_left_curly(content):
    """修复左花括号位置：从独占一行改为行尾"""
    # 先移除类/方法/控制语句后的换行+空格+{
    # 匹配模式：行尾 + 换行 + 空白 + {
    
    # 1. 修复类/接口/枚举/记录声明
    # public class Foo {  -> 应该已经在行尾，不需要修复
    # public class Foo\n{  -> 需要修复
    content = re.sub(
        r'^(public\s+|final\s+|abstract\s+|private\s+)?(class|interface|enum|record)\s+(\w+)(<[^>]+>)?(\s+extends\s+[\w<>,\s]+)?(\s+implements\s+[\w<>,\s]+)?\s*\n\s*{',
        lambda m: m.group(0).split('\n')[0].rstrip() + ' {',
        content, flags=re.MULTILINE
    )
    
    # 2. 修复方法声明 - 使用更精确的模式
    # 匹配方法签名（包括泛型）后面跟着换行和 {
    # 例如：public static <T> ApiResponse<T> success(T data)\n{
    method_pattern = r'^((?:\s+)(?:public|private|protected|static|final|abstract|synchronized|native|\s)*<[^>]+>\s+[\w<>,\s\[\]]+\s+\w+\s*\([^)]*\)|(?:\s+)(?:public|private|protected|static|final|abstract|synchronized|native|\s)+[\w<>,\s\[\]]+\s+\w+\s*\([^)]*\))\s*\n\s*{'
    
    def fix_method_curly(match):
        sig = match.group(1).rstrip()
        return sig + ' {'
    
    content = re.sub(method_pattern, fix_method_curly, content, flags=re.MULTILINE)
    
    # 3. 修复控制语句
    control_patterns = [
        (r'(if\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(else\s+if\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(?<=[^\w])else\s*\n\s*\{', r'else {'),
        (r'(for\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(while\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(?<=[^\w])do\s*\n\s*\{', r'do {'),
        (r'(?<=[^\w])try\s*\n\s*\{', r'try {'),
        (r'(catch\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
        (r'(?<=[^\w])finally\s*\n\s*\{', r'finally {'),
        (r'(switch\s*\([^)]+\))\s*\n\s*\{', r'\1 {'),
    ]
    
    for pattern, repl in control_patterns:
        content = re.sub(pattern, repl, content)
    
    return content


def fix_import_order(content):
    """修复 import 顺序"""
    lines = content.split('\n')
    
    # 提取 package 声明
    package_line = None
    package_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('package '):
            package_line = line
            package_idx = i + 1
            break
    
    # 提取 imports
    imports = []
    import_end_idx = package_idx
    
    for i in range(package_idx, len(lines)):
        line = lines[i]
        if line.startswith('import '):
            imports.append(line)
            import_end_idx = i + 1
        elif line.strip() == '' and imports and i > package_idx:
            # 空行，如果前面是 import，则继续
            if lines[i-1].startswith('import ') or (i > 0 and lines[i-1].strip() == ''):
                import_end_idx = i + 1
            else:
                break
        elif not line.startswith('import ') and line.strip() != '':
            break
    
    if not imports:
        return content
    
    # 分类 imports
    java_imports = []
    javax_imports = []
    org_imports = []
    com_fasterxml_imports = []
    com_imports = []
    other_imports = []
    
    for imp in imports:
        if 'import static ' in imp:
            other_imports.append(imp)
        elif imp.startswith('import java.'):
            java_imports.append(imp)
        elif imp.startswith('import javax.'):
            javax_imports.append(imp)
        elif imp.startswith('import org.'):
            org_imports.append(imp)
        elif imp.startswith('import com.fasterxml.'):
            com_fasterxml_imports.append(imp)
        elif imp.startswith('import com.'):
            com_imports.append(imp)
        else:
            other_imports.append(imp)
    
    # 排序并去重
    def sort_key(imp):
        return imp.replace('import ', '')
    
    java_imports = sorted(set(java_imports), key=sort_key)
    javax_imports = sorted(set(javax_imports), key=sort_key)
    org_imports = sorted(set(org_imports), key=sort_key)
    com_fasterxml_imports = sorted(set(com_fasterxml_imports), key=sort_key)
    com_imports = sorted(set(com_imports), key=sort_key)
    other_imports = sorted(set(other_imports), key=sort_key)
    
    # 组合，组间加空行
    sorted_imports = []
    if java_imports:
        sorted_imports.extend(java_imports)
    if javax_imports:
        if sorted_imports:
            sorted_imports.append('')
        sorted_imports.extend(javax_imports)
    if org_imports:
        if sorted_imports:
            sorted_imports.append('')
        sorted_imports.extend(org_imports)
    if com_fasterxml_imports:
        if sorted_imports:
            sorted_imports.append('')
        sorted_imports.extend(com_fasterxml_imports)
    if com_imports:
        if sorted_imports:
            sorted_imports.append('')
        sorted_imports.extend(com_imports)
    if other_imports:
        if sorted_imports:
            sorted_imports.append('')
        sorted_imports.extend(other_imports)
    
    # 重建文件
    new_lines = lines[:package_idx]
    if sorted_imports:
        new_lines.extend(sorted_imports)
        new_lines.append('')
    new_lines.extend(lines[import_end_idx:])
    
    return '\n'.join(new_lines)


def process_file(filepath, dry_run=False):
    """处理单个文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return False
    
    original = content
    
    # 应用修复
    content = fix_import_order(content)
    content = fix_left_curly(content)
    
    if content != original:
        if not dry_run:
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Fixed: {filepath}")
            except Exception as e:
                print(f"Error writing {filepath}: {e}")
                return False
        else:
            print(f"Would fix: {filepath}")
        return True
    return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python fix-checkstyle-v2.py <directory> [--dry-run]")
        sys.exit(1)
    
    target_dir = sys.argv[1]
    dry_run = '--dry-run' in sys.argv
    
    fixed_count = 0
    for root, dirs, files in os.walk(target_dir):
        # 跳过 target 目录
        if 'target' in root:
            continue
        for file in files:
            if file.endswith('.java'):
                filepath = os.path.join(root, file)
                if process_file(filepath, dry_run):
                    fixed_count += 1
    
    print(f"\nTotal files {'would be ' if dry_run else ''}fixed: {fixed_count}")


if __name__ == '__main__':
    main()
