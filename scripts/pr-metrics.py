#!/usr/bin/env python3
"""
PR 审阅指标统计脚本

功能：
- 统计 PR 首次响应时间（P50, P90）
- 统计 PR 合并时长（P50, P90）
- 支持按时间范围筛选
- 输出周报格式

使用：
    python scripts/pr-metrics.py [--days 7] [--repo owner/repo]

依赖：
    - Python 3.8+
    - GitHub CLI (gh) 已登录

参考指标（A 线）：
- PR 首次响应：P50 < 4h，P90 < 24h
- PR 合并周期：P50 < 24h，P90 < 72h
"""

import json
import subprocess
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass
from statistics import median
import argparse


@dataclass
class PRMetrics:
    """单个 PR 的指标数据"""
    number: int
    title: str
    author: str
    state: str
    created_at: datetime
    merged_at: Optional[datetime]
    first_response_at: Optional[datetime]
    first_response_hours: Optional[float]
    merge_duration_hours: Optional[float]
    url: str


def run_gh_command(args: List[str]) -> dict:
    """执行 gh 命令并返回 JSON 结果"""
    cmd = ["gh"] + args + ["--json", "number,title,author,state,createdAt,mergedAt,url,comments,reviews"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error running gh command: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    
    return json.loads(result.stdout)


def parse_datetime(dt_str: str) -> Optional[datetime]:
    """解析 ISO 格式时间字符串"""
    if not dt_str:
        return None
    # 处理带 Z 的 UTC 时间
    dt_str = dt_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(dt_str)
    except ValueError:
        return None


def calculate_hours(start: datetime, end: datetime) -> float:
    """计算两个时间之间的小时数"""
    diff = end - start
    return diff.total_seconds() / 3600


def get_first_response_time(pr_data: dict) -> Optional[datetime]:
    """获取 PR 的首次响应时间（评论或审查）"""
    first_response = None
    created_at = parse_datetime(pr_data.get("createdAt"))
    
    if not created_at:
        return None
    
    # 检查评论
    comments = pr_data.get("comments", [])
    for comment in comments:
        # 排除 PR 作者自己的评论
        if comment.get("author", {}).get("login") != pr_data.get("author", {}).get("login"):
            comment_time = parse_datetime(comment.get("createdAt"))
            if comment_time and (not first_response or comment_time < first_response):
                first_response = comment_time
    
    # 检查审查
    reviews = pr_data.get("reviews", [])
    for review in reviews:
        # 排除 PR 作者自己的审查
        if review.get("author", {}).get("login") != pr_data.get("author", {}).get("login"):
            review_time = parse_datetime(review.get("createdAt"))
            if review_time and (not first_response or review_time < first_response):
                first_response = review_time
    
    return first_response


def fetch_prs(repo: str, state: str = "all", limit: int = 100) -> List[dict]:
    """获取 PR 列表"""
    cmd = [
        "pr", "list",
        "--repo", repo,
        "--state", state,
        "--limit", str(limit),
        "--json", "number,title,author,state,createdAt,mergedAt,url,comments,reviews"
    ]
    result = subprocess.run(["gh"] + cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error fetching PRs: {result.stderr}", file=sys.stderr)
        return []
    
    return json.loads(result.stdout)


def get_detailed_pr(repo: str, pr_number: int) -> Optional[dict]:
    """获取单个 PR 的详细信息（包括评论和审查）"""
    cmd = [
        "pr", "view", str(pr_number),
        "--repo", repo,
        "--json", "number,title,author,state,createdAt,mergedAt,url,comments,reviews"
    ]
    result = subprocess.run(["gh"] + cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        return None
    
    return json.loads(result.stdout)


def calculate_metrics(prs: List[dict], days: int, repo: str) -> List[PRMetrics]:
    """计算 PR 指标"""
    # 使用带时区的当前时间
    now = datetime.now().astimezone()
    cutoff_date = now - timedelta(days=days)
    metrics_list = []
    
    for pr in prs:
        created_at = parse_datetime(pr.get("createdAt"))
        
        # 只统计在指定时间范围内创建的 PR
        if not created_at or created_at < cutoff_date:
            continue
        
        # 获取详细信息（包含评论和审查）
        detailed_pr = get_detailed_pr(repo, pr.get("number"))
        if not detailed_pr:
            detailed_pr = pr
        
        merged_at = parse_datetime(detailed_pr.get("mergedAt"))
        first_response_at = get_first_response_time(detailed_pr)
        
        # 计算首次响应时间
        first_response_hours = None
        if first_response_at and created_at:
            first_response_hours = calculate_hours(created_at, first_response_at)
        
        # 计算合并时长
        merge_duration_hours = None
        if merged_at and created_at:
            merge_duration_hours = calculate_hours(created_at, merged_at)
        
        metrics = PRMetrics(
            number=detailed_pr.get("number"),
            title=detailed_pr.get("title", ""),
            author=detailed_pr.get("author", {}).get("login", ""),
            state=detailed_pr.get("state", ""),
            created_at=created_at,
            merged_at=merged_at,
            first_response_at=first_response_at,
            first_response_hours=first_response_hours,
            merge_duration_hours=merge_duration_hours,
            url=detailed_pr.get("url", "")
        )
        metrics_list.append(metrics)
    
    return metrics_list


def calculate_percentile(values: List[float], percentile: float) -> Optional[float]:
    """计算百分位数"""
    if not values:
        return None
    sorted_values = sorted(values)
    index = int(len(sorted_values) * percentile / 100)
    return sorted_values[min(index, len(sorted_values) - 1)]


def format_hours(hours: Optional[float]) -> str:
    """格式化小时数为可读字符串"""
    if hours is None:
        return "N/A"
    
    if hours < 1:
        return f"{int(hours * 60)}m"
    elif hours < 24:
        return f"{hours:.1f}h"
    else:
        days = int(hours / 24)
        remaining_hours = hours % 24
        return f"{days}d {remaining_hours:.1f}h"


def print_report(metrics_list: List[PRMetrics], days: int, target_repo: str):
    """打印统计报告"""
    now = datetime.now()
    start_date = now - timedelta(days=days)
    
    print("=" * 70)
    print(f"📊 PR 审阅指标周报")
    print(f"仓库: {target_repo}")
    print(f"统计周期: {start_date.strftime('%Y-%m-%d')} ~ {now.strftime('%Y-%m-%d')} ({days} 天)")
    print("=" * 70)
    print()
    
    # 过滤出已合并的 PR
    merged_prs = [m for m in metrics_list if m.state == "MERGED"]
    open_prs = [m for m in metrics_list if m.state == "OPEN"]
    closed_prs = [m for m in metrics_list if m.state == "CLOSED" and not m.merged_at]
    
    print(f"📈 PR 概况:")
    print(f"   总计: {len(metrics_list)} 个 PR")
    print(f"   - 已合并: {len(merged_prs)} 个")
    print(f"   - 进行中: {len(open_prs)} 个")
    print(f"   - 已关闭（未合并）: {len(closed_prs)} 个")
    print()
    
    # 首次响应时间统计
    response_times = [m.first_response_hours for m in metrics_list if m.first_response_hours is not None]
    
    print("⏱️  首次响应时间 (First Response Time):")
    print("   " + "-" * 50)
    if response_times:
        p50 = calculate_percentile(response_times, 50)
        p90 = calculate_percentile(response_times, 90)
        avg = sum(response_times) / len(response_times)
        
        print(f"   P50: {format_hours(p50)} {'✅' if p50 and p50 < 4 else '⚠️'} (目标: < 4h)")
        print(f"   P90: {format_hours(p90)} {'✅' if p90 and p90 < 24 else '⚠️'} (目标: < 24h)")
        print(f"   平均: {format_hours(avg)}")
        print(f"   有响应的 PR: {len(response_times)}/{len(metrics_list)} ({len(response_times)/len(metrics_list)*100:.1f}%)")
    else:
        print("   暂无响应数据")
    print()
    
    # 合并时长统计
    merge_times = [m.merge_duration_hours for m in merged_prs if m.merge_duration_hours is not None]
    
    print("🔄 合并周期 (Merge Duration):")
    print("   " + "-" * 50)
    if merge_times:
        p50 = calculate_percentile(merge_times, 50)
        p90 = calculate_percentile(merge_times, 90)
        avg = sum(merge_times) / len(merge_times)
        
        print(f"   P50: {format_hours(p50)} {'✅' if p50 and p50 < 24 else '⚠️'} (目标: < 24h)")
        print(f"   P90: {format_hours(p90)} {'✅' if p90 and p90 < 72 else '⚠️'} (目标: < 72h)")
        print(f"   平均: {format_hours(avg)}")
    else:
        print("   暂无合并数据")
    print()
    
    # 目标达成情况
    print("🎯 目标达成情况 (A 线):")
    print("   " + "-" * 50)
    
    response_p50_ok = response_times and calculate_percentile(response_times, 50) and calculate_percentile(response_times, 50) < 4
    response_p90_ok = response_times and calculate_percentile(response_times, 90) and calculate_percentile(response_times, 90) < 24
    merge_p50_ok = merge_times and calculate_percentile(merge_times, 50) and calculate_percentile(merge_times, 50) < 24
    merge_p90_ok = merge_times and calculate_percentile(merge_times, 90) and calculate_percentile(merge_times, 90) < 72
    
    print(f"   PR 首次响应 P50 < 4h:   {'✅ 达标' if response_p50_ok else '❌ 未达标' if response_times else '⏳ 无数据'}")
    print(f"   PR 首次响应 P90 < 24h:  {'✅ 达标' if response_p90_ok else '❌ 未达标' if response_times else '⏳ 无数据'}")
    print(f"   PR 合并周期 P50 < 24h:  {'✅ 达标' if merge_p50_ok else '❌ 未达标' if merge_times else '⏳ 无数据'}")
    print(f"   PR 合并周期 P90 < 72h:  {'✅ 达标' if merge_p90_ok else '❌ 未达标' if merge_times else '⏳ 无数据'}")
    print()
    
    # 详细列表（可选）
    if len(metrics_list) <= 10:
        print("📋 PR 详情:")
        print("   " + "-" * 50)
        for m in sorted(metrics_list, key=lambda x: x.number, reverse=True):
            status = "🟢" if m.state == "OPEN" else "🟣" if m.state == "MERGED" else "🔴"
            response_str = format_hours(m.first_response_hours) if m.first_response_hours else "无响应"
            merge_str = format_hours(m.merge_duration_hours) if m.merge_duration_hours else "未合并"
            print(f"   {status} #{m.number}: 响应 {response_str} | 合并 {merge_str}")
            print(f"      {m.title[:50]}{'...' if len(m.title) > 50 else ''}")
        print()
    
    print("=" * 70)
    print("提示: 使用 --days N 指定统计天数，--repo owner/repo 指定仓库")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="PR 审阅指标统计")
    parser.add_argument("--days", type=int, default=7, help="统计最近 N 天的数据 (默认: 7)")
    parser.add_argument("--repo", type=str, default=None, help="仓库名称 (格式: owner/repo)")
    parser.add_argument("--limit", type=int, default=100, help="获取的 PR 数量上限 (默认: 100)")
    
    args = parser.parse_args()
    
    # 获取当前仓库
    if args.repo:
        target_repo = args.repo
    else:
        # 尝试从 git remote 获取
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            url = result.stdout.strip()
            # 解析 git@github.com:owner/repo.git 或 https://github.com/owner/repo.git
            if "github.com" in url:
                if url.startswith("git@"):
                    target_repo = url.split(":")[1].replace(".git", "")
                else:
                    target_repo = url.split("github.com/")[1].replace(".git", "")
            else:
                print("无法自动识别仓库，请使用 --repo 参数指定", file=sys.stderr)
                sys.exit(1)
        else:
            print("无法获取仓库信息，请使用 --repo 参数指定", file=sys.stderr)
            sys.exit(1)
    
    print(f"正在获取 {target_repo} 的 PR 数据...")
    
    # 获取 PR 列表
    prs = fetch_prs(target_repo, state="all", limit=args.limit)
    
    if not prs:
        print("未找到 PR 数据")
        return
    
    # 计算指标
    metrics_list = calculate_metrics(prs, args.days, target_repo)
    
    # 打印报告
    print_report(metrics_list, args.days, target_repo)


if __name__ == "__main__":
    main()
