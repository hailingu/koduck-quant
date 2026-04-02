#!/usr/bin/env python3
"""
仅修复 import 顺序
"""

import os
import sys


def fix_import_order(content):
    """修复 import 顺序"""
    lines = content.split('\n')
    
    # 提取 package 声明
    package_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('package '):
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


def process_file(filepath):
    """处理单个文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return False
    
    original = content
    content = fix_import_order(content)
    
    if content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {filepath}")
            return True
        except Exception as e:
            print(f"Error writing {filepath}: {e}")
            return False
    return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python fix-imports-only.py <directory>")
        sys.exit(1)
    
    target_dir = sys.argv[1]
    fixed_count = 0
    
    for root, dirs, files in os.walk(target_dir):
        if 'target' in root:
            continue
        for file in files:
            if file.endswith('.java'):
                filepath = os.path.join(root, file)
                if process_file(filepath):
                    fixed_count += 1
    
    print(f"\nTotal files fixed: {fixed_count}")


if __name__ == '__main__':
    main()
