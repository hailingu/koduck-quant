#!/usr/bin/env python3
"""
批量修复 koduck-backend 的 checkstyle 告警
"""

import re
import os
import sys
from pathlib import Path


def fix_left_curly(content):
    """修复左花括号位置：从独占一行改为行尾"""
    # 修复类声明
    content = re.sub(r'^(public\s+|final\s+|abstract\s+)?(class|interface|enum|record)\s+(\w+)(<[^>]+>)?(\s+extends\s+\w+)?(\s+implements\s+[\w,\s]+)?\s*\n\s*{', 
                     r'\1\2 \3\4\5\6 {', content, flags=re.MULTILINE)
    
    # 修复方法声明
    content = re.sub(r'^(\s+)(public|private|protected|static|final|abstract|\s)+[\w<>,\s\[\]]+\w+\([^)]*\)\s*\n\s*{',
                     lambda m: m.group(0).replace('\n', '').replace('  ', ' ') + '\n{', content, flags=re.MULTILINE)
    content = re.sub(r'\n\s*\n\s*{', ' {', content)
    
    # 修复控制语句 - 简化处理，使用更宽松的模式
    # if/for/while/try/catch/switch
    patterns = [
        (r'(if\s*\([^)]+\))\s*\n\s*{', r'\1 {'),
        (r'(else)\s*\n\s*{', r'\1 {'),
        (r'(for\s*\([^)]+\))\s*\n\s*{', r'\1 {'),
        (r'(while\s*\([^)]+\))\s*\n\s*{', r'\1 {'),
        (r'(do)\s*\n\s*{', r'\1 {'),
        (r'(try)\s*\n\s*{', r'\1 {'),
        (r'(catch\s*\([^)]+\))\s*\n\s*{', r'\1 {'),
        (r'(finally)\s*\n\s*{', r'\1 {'),
        (r'(switch\s*\([^)]+\))\s*\n\s*{', r'\1 {'),
    ]
    
    for pattern, repl in patterns:
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
    other_lines = []
    in_imports = False
    import_end_idx = package_idx
    
    for i in range(package_idx, len(lines)):
        line = lines[i]
        if line.startswith('import '):
            imports.append(line)
            in_imports = True
            import_end_idx = i + 1
        elif in_imports and line.strip() == '':
            import_end_idx = i + 1
        elif in_imports and not line.startswith('import ') and line.strip() != '':
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
    
    # 排序
    def sort_key(imp):
        return imp.replace('import ', '')
    
    java_imports = sorted(set(java_imports), key=sort_key)
    javax_imports = sorted(set(javax_imports), key=sort_key)
    org_imports = sorted(set(org_imports), key=sort_key)
    com_fasterxml_imports = sorted(set(com_fasterxml_imports), key=sort_key)
    com_imports = sorted(set(com_imports), key=sort_key)
    other_imports = sorted(set(other_imports), key=sort_key)
    
    # 组合
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


def fix_magic_numbers(content, is_test=False):
    """修复魔法数字 - 仅在非测试文件中提取常见常量"""
    if is_test:
        # 测试文件中通常允许魔法数字
        return content
    
    # 提取类名
    class_match = re.search(r'public\s+(?:class|enum|interface)\s+(\w+)', content)
    if not class_match:
        return content
    class_name = class_match.group(1)
    
    # 常见的魔法数字映射
    magic_map = {
        r'\b20\b': 'DEFAULT_PAGE_SIZE',
        r'\b10\b': 'DEFAULT_LIMIT',
        r'\b100\b': 'MAX_LIMIT',
        r'\b50\b': 'HALF_HUNDRED',
        r'\b200\b': 'MAX_RESULTS',
    }
    
    # 添加常量声明
    constants = []
    for magic, const_name in magic_map.items():
        if re.search(magic, content) and not re.search(rf'\b{const_name}\b', content):
            constants.append(f'    private static final int {const_name} = {magic.strip("\\b")};')
    
    if constants:
        # 在第一个字段前插入常量
        first_field = re.search(r'(\n\s+private\s+\w+)', content)
        if first_field:
            insert_pos = first_field.start()
            content = content[:insert_pos] + '\n' + '\n'.join(constants) + content[insert_pos:]
    
    return content


def process_file(filepath, dry_run=False):
    """处理单个文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return False
    
    original = content
    is_test = '/test/' in filepath
    
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
        print("Usage: python fix-checkstyle.py <directory> [--dry-run]")
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
