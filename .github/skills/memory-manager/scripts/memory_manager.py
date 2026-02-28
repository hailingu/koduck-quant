#!/usr/bin/env python3
"""
Memory Manager - Persistent memory management for AI agents.

Provides file-based memory persistence across sessions with:
- 3-tier memory hierarchy (L1 Raw Logs / L2 Theme / L3 Global)
- Session lifecycle hooks (auto-init / auto-cleanup)
- Smart triggers for automatic memory capture
- Quality scoring for memory filtering
"""

import os
import json
import argparse
import datetime
import hashlib
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import sys

class MemoryManager:
    """File-based memory management system with 3-tier hierarchy."""
    
    def __init__(self, workspace_root=None):
        self.workspace_root = workspace_root or os.getcwd()
        self.memory_dir = os.path.join(self.workspace_root, "memory")
        self.global_memory_file = os.path.join(self.memory_dir, "global.md")
        
        # 3-tier structure
        self.l1_sessions_dir = os.path.join(self.memory_dir, "sessions")  # Raw logs
        self.l2_themes_dir = self.memory_dir  # Theme-based working memory
        self.l3_global_file = self.global_memory_file  # Long-term memory
        
        # Metadata tracking
        self.metadata_file = os.path.join(self.memory_dir, ".metadata.json")
        
        # Ensure directories exist
        os.makedirs(self.memory_dir, exist_ok=True)
        os.makedirs(self.l1_sessions_dir, exist_ok=True)
    
    # ========== L1: Raw Session Logs ==========
    
    def get_session_log_path(self, date=None):
        """Get path for daily session log file."""
        if date is None:
            date = datetime.datetime.now()
        date_str = date.strftime("%Y-%m-%d")
        return os.path.join(self.l1_sessions_dir, f"{date_str}.md")
    
    def append_session_log(self, entry_type: str, content: str, 
                          tools_used: List[str] = None, 
                          session_id: str = None) -> str:
        """
        Append entry to L1 raw session log.
        Auto-captured every turn, no quality check needed.
        """
        file_path = self.get_session_log_path()
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Build entry
        entry_lines = [f"### [{timestamp}] {entry_type.upper()}"]
        if session_id:
            entry_lines.append(f"**Session:** {session_id}")
        if tools_used:
            entry_lines.append(f"**Tools:** {', '.join(tools_used)}")
        entry_lines.append("")
        entry_lines.append(content)
        entry_lines.append("")
        entry_lines.append("---")
        
        entry_text = "\n".join(entry_lines)
        
        # Append to file
        if os.path.exists(file_path):
            with open(file_path, 'a', encoding='utf-8') as f:
                f.write(f"\n\n{entry_text}")
        else:
            # Create new file with header
            header = f"# Session Log - {datetime.datetime.now().strftime('%Y-%m-%d')}\n\n"
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(header + entry_text)
        
        return file_path
    
    def read_session_logs(self, days_back: int = 7) -> List[Dict]:
        """Read recent session logs."""
        logs = []
        cutoff = datetime.datetime.now() - datetime.timedelta(days=days_back)
        
        for filename in sorted(os.listdir(self.l1_sessions_dir), reverse=True):
            if not filename.endswith('.md'):
                continue
            
            try:
                date_str = filename.replace('.md', '')
                file_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
                
                if file_date >= cutoff:
                    file_path = os.path.join(self.l1_sessions_dir, filename)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    logs.append({
                        'date': date_str,
                        'content': content,
                        'size': len(content)
                    })
            except ValueError:
                continue
        
        return logs
    
    # ========== L2: Theme-Based Working Memory ==========
    
    def get_theme_path(self, theme: str, timestamp=None):
        """Get path for theme-based memory file."""
        if timestamp is None:
            timestamp = datetime.datetime.now()
        
        time_str = timestamp.strftime("%Y-%m-%d_%H")
        theme_dir = os.path.join(self.l2_themes_dir, theme)
        os.makedirs(theme_dir, exist_ok=True)
        
        return os.path.join(theme_dir, f"{time_str}.md")
    
    def write_theme_memory(self, theme: str, content: str, 
                          timestamp=None, template: str = None) -> str:
        """
        Write to L2 theme-based memory.
        Supports simplified templates.
        """
        file_path = self.get_theme_path(theme, timestamp)
        now = timestamp or datetime.datetime.now()
        timestamp_str = now.strftime("%Y-%m-%d %H:%M:%S")
        
        # Apply template if specified
        if template == "decision":
            formatted = f"## Decision Record - {timestamp_str}\n\n{content}\n"
        elif template == "error":
            formatted = f"## Error Post-mortem - {timestamp_str}\n\n{content}\n"
        elif template == "task":
            formatted = f"## Task Progress - {timestamp_str}\n\n{content}\n"
        else:
            # Simple format - minimal overhead
            formatted = f"## {timestamp_str}\n\n{content}\n"
        
        # Append or create
        if os.path.exists(file_path):
            with open(file_path, 'a', encoding='utf-8') as f:
                f.write(f"\n\n{formatted}")
        else:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(formatted)
        
        return file_path
    
    def read_theme_memory(self, theme: str, hours_back: int = 24) -> List[Dict]:
        """Read recent theme-based memories."""
        theme_dir = os.path.join(self.l2_themes_dir, theme)
        if not os.path.exists(theme_dir):
            return []
        
        files = sorted(os.listdir(theme_dir), reverse=True)
        memories = []
        cutoff = datetime.datetime.now() - datetime.timedelta(hours=hours_back)
        
        for file in files:
            if not file.endswith('.md'):
                continue
            
            try:
                time_str = file.replace('.md', '')
                file_time = datetime.datetime.strptime(time_str, "%Y-%m-%d_%H")
                
                if file_time >= cutoff:
                    file_path = os.path.join(theme_dir, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    memories.append({
                        'timestamp': file_time.isoformat(),
                        'filename': file,
                        'content': content
                    })
            except ValueError:
                continue
        
        return memories
    
    def list_themes(self) -> List[str]:
        """List all available memory themes."""
        themes = []
        if not os.path.exists(self.memory_dir):
            return themes
        
        for item in os.listdir(self.memory_dir):
            item_path = os.path.join(self.memory_dir, item)
            # Skip non-directory items and special directories
            if os.path.isdir(item_path) and item not in ['sessions', 'archive']:
                themes.append(item)
        
        return sorted(themes)
    
    # ========== L3: Global Long-Term Memory ==========
    
    def read_global_memory(self) -> str:
        """Read L3 global long-term memory."""
        if not os.path.exists(self.l3_global_file):
            return "# Global Memory\n\n*No global memory yet.*"
        
        with open(self.l3_global_file, 'r', encoding='utf-8') as f:
            return f.read()
    
    def write_global_memory(self, content: str, append: bool = True) -> None:
        """Write to L3 global long-term memory."""
        if append and os.path.exists(self.l3_global_file):
            with open(self.l3_global_file, 'a', encoding='utf-8') as f:
                f.write(f"\n\n{content}")
        else:
            with open(self.l3_global_file, 'w', encoding='utf-8') as f:
                f.write(content)
    
    # ========== Session Lifecycle Hooks ==========
    
    def session_init(self, session_context: dict = None) -> Dict:
        """
        Session initialization hook.
        Auto-loads global memory and recent themes.
        """
        result = {
            'status': 'success',
            'global_loaded': False,
            'themes_loaded': [],
            'recent_logs': [],
            'context': {}
        }
        
        try:
            # Load global memory
            global_content = self.read_global_memory()
            result['global_loaded'] = True
            result['context']['global'] = global_content[:2000] if len(global_content) > 2000 else global_content
            
            # Scan recent themes (last 7 days)
            for theme in self.list_themes():
                memories = self.read_theme_memory(theme, hours_back=168)  # 7 days
                if memories:
                    result['themes_loaded'].append({
                        'theme': theme,
                        'entries': len(memories)
                    })
                    # Include summary in context
                    result['context'][f'theme_{theme}'] = f"[{len(memories)} recent entries]"
            
            # Load recent session logs summary
            recent_logs = self.read_session_logs(days_back=3)
            result['recent_logs'] = [log['date'] for log in recent_logs[:3]]
            
            # Log the init event
            self.append_session_log(
                entry_type="session_init",
                content=f"Session initialized. Loaded {len(result['themes_loaded'])} themes.",
                session_id=session_context.get('session_id') if session_context else None
            )
            
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
        
        return result
    
    def session_end(self, session_summary: dict = None, auto_distill: bool = True) -> Dict:
        """
        Session end hook.
        Generates daily summary and optionally distills to global.
        """
        result = {
            'status': 'success',
            'summary_generated': False,
            'distilled_to_global': False,
            'actions': []
        }
        
        try:
            # Get today's session logs
            today = datetime.datetime.now().strftime("%Y-%m-%d")
            session_log_path = self.get_session_log_path()
            
            if os.path.exists(session_log_path):
                with open(session_log_path, 'r', encoding='utf-8') as f:
                    today_logs = f.read()
                
                # Generate summary entry
                summary_content = self._generate_session_summary(today_logs, session_summary)
                
                # Write to daily summary (L2: daily-summaries theme)
                summary_path = self.write_theme_memory(
                    theme="daily-summaries",
                    content=summary_content,
                    template="task"
                )
                result['summary_generated'] = True
                result['actions'].append(f"Summary written to {summary_path}")
                
                # Auto-distill if enabled and session is significant
                if auto_distill and self._should_distill_to_global(today_logs, session_summary):
                    self._distill_to_global(summary_content)
                    result['distilled_to_global'] = True
                    result['actions'].append("Key insights distilled to global memory")
            
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
        
        return result
    
    def _generate_session_summary(self, logs: str, session_summary: dict = None) -> str:
        """Generate a summary from session logs."""
        lines = logs.split('\n')
        
        # Count entry types
        entry_types = {}
        for line in lines:
            if line.startswith('### ['):
                entry_type = line.split('] ')[-1].lower() if '] ' in line else 'unknown'
                entry_types[entry_type] = entry_types.get(entry_type, 0) + 1
        
        summary_parts = [
            f"**Session Date:** {datetime.datetime.now().strftime('%Y-%m-%d')}",
            f"**Total Entries:** {len([l for l in lines if l.startswith('### ')])}",
            f"**Entry Types:** {', '.join([f'{k}({v})' for k, v in entry_types.items()])}",
        ]
        
        if session_summary:
            if 'key_decisions' in session_summary:
                summary_parts.append(f"**Key Decisions:** {session_summary['key_decisions']}")
            if 'errors_encountered' in session_summary:
                summary_parts.append(f"**Errors:** {session_summary['errors_encountered']}")
        
        return '\n'.join(summary_parts)
    
    def _should_distill_to_global(self, logs: str, session_summary: dict = None) -> bool:
        """Determine if session is significant enough for global memory."""
        # Criteria for global distillation
        significant_signals = [
            'error' in logs.lower() or 'fail' in logs.lower(),
            session_summary and session_summary.get('has_decisions', False),
            len(logs) > 5000,  # Long session = more context
            'user preference' in logs.lower() or 'remember' in logs.lower(),
        ]
        return any(significant_signals)
    
    def _distill_to_global(self, summary: str) -> None:
        """Distill session summary to global memory."""
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        entry = f"## Auto-distilled Summary - {timestamp}\n\n{summary}\n"
        self.write_global_memory(entry, append=True)
    
    # ========== Smart Triggers ==========
    
    def quick_note(self, content: str, theme: str = "misc", 
                   auto_theme: bool = False) -> Dict:
        """
        Quick note capture - minimal friction.
        Supports auto-theme detection from content.
        """
        result = {'status': 'success'}
        
        # Auto-detect theme if enabled
        if auto_theme:
            theme = self._detect_theme(content)
        
        # Write to L2
        file_path = self.write_theme_memory(theme, content)
        result['theme'] = theme
        result['path'] = file_path
        
        # Also log to L1
        self.append_session_log(
            entry_type="quick_note",
            content=f"Theme: {theme} | Content: {content[:100]}..."
        )
        
        return result
    
    def _detect_theme(self, content: str) -> str:
        """Auto-detect theme from content keywords."""
        content_lower = content.lower()
        
        theme_keywords = {
            'agent': ['agent', 'cortana', 'delegation', 'subagent'],
            'coding': ['code', 'function', 'class', 'refactor', 'bug', 'fix'],
            'architecture': ['design', 'api', 'system', 'component', 'interface'],
            'devops': ['deploy', 'pipeline', 'ci/cd', 'docker', 'kubernetes'],
            'data': ['data', 'database', 'query', 'model', 'analytics'],
            'error': ['error', 'exception', 'fail', 'crash', 'bug'],
            'decision': ['decision', 'choose', 'select', 'option', 'alternatives'],
        }
        
        scores = {}
        for theme, keywords in theme_keywords.items():
            score = sum(1 for kw in keywords if kw in content_lower)
            if score > 0:
                scores[theme] = score
        
        if scores:
            return max(scores, key=scores.get)
        return "misc"
    
    def should_capture_from_turn(self, user_msg: str, agent_response: str,
                                 tools_used: List[str], turn_count: int) -> Tuple[bool, str, dict]:
        """
        Smart trigger - analyze a conversation turn and decide if worth capturing.
        Returns: (should_capture, capture_type, metadata)
        """
        signals = {
            'user_correction': False,
            'complex_task': False,
            'emotional_signal': False,
            'tool_heavy': False,
            'error_context': False,
        }
        
        user_lower = user_msg.lower()
        response_lower = agent_response.lower()
        
        # Detect user corrections
        correction_patterns = ['不对', '错了', '应该是', '不对不对', 'no,', 'incorrect', 'wrong', 'not right']
        signals['user_correction'] = any(p in user_lower for p in correction_patterns)
        
        # Detect emotional signals
        satisfaction_patterns = ['谢谢', '完美', 'great', 'perfect', 'awesome', 'excellent']
        dissatisfaction_patterns = ['不行', '还是', 'still', 'not working', 'fails']
        signals['emotional_signal'] = any(p in user_lower for p in satisfaction_patterns + dissatisfaction_patterns)
        
        # Detect errors in response
        error_patterns = ['error', 'exception', 'fail', 'crash', 'timeout', 'unable to', 'cannot']
        signals['error_context'] = any(p in response_lower for p in error_patterns)
        
        # Complex task signals
        signals['tool_heavy'] = len(tools_used) >= 3
        signals['complex_task'] = turn_count >= 5 or len(tools_used) >= 3
        
        # Decision logic
        if signals['user_correction']:
            return True, 'error_post_mortem', {'reason': 'user_correction', **signals}
        
        if signals['error_context']:
            return True, 'error_log', {'reason': 'error_occurred', **signals}
        
        if signals['emotional_signal'] and signals['complex_task']:
            return True, 'task_summary', {'reason': 'complex_task_completed', **signals}
        
        if signals['tool_heavy'] and turn_count % 5 == 0:  # Every 5 turns if tool-heavy
            return True, 'progress_snapshot', {'reason': 'milestone', **signals}
        
        return False, 'skip', signals
    
    # ========== Quality Assessment ==========
    
    def score_content_quality(self, content: str, context: dict = None) -> Dict:
        """
        Score content quality for memory persistence.
        Returns quality metrics and persistence recommendation.
        """
        scores = {
            'length_score': 0,
            'information_density': 0,
            'uniqueness_score': 100,  # Default to unique
            'recency_boost': 0,
            'total_score': 0,
        }
        
        # Length score (0-30)
        content_len = len(content)
        if content_len < 20:
            scores['length_score'] = 0
        elif content_len < 100:
            scores['length_score'] = 10
        elif content_len < 500:
            scores['length_score'] = 20
        else:
            scores['length_score'] = 30
        
        # Information density (0-40)
        # Check for specific patterns that indicate valuable content
        valuable_patterns = [
            r'\b(decided|decision|chose|selected)\b',
            r'\b(error|bug|fix|solved|resolved)\b',
            r'\b(lesson learned|takeaway|insight)\b',
            r'\b(architecture|design pattern|best practice)\b',
            r'\b(记住|remember|preference|prefer)\b',
        ]
        density_score = sum(10 for p in valuable_patterns if re.search(p, content, re.I))
        scores['information_density'] = min(40, density_score)
        
        # Uniqueness check against existing memories
        uniqueness = self._check_uniqueness(content)
        scores['uniqueness_score'] = uniqueness['score']
        scores['similar_to'] = uniqueness.get('similar_to', [])
        
        # Recency boost for certain types
        if context and context.get('is_error'):
            scores['recency_boost'] = 20
        elif context and context.get('is_decision'):
            scores['recency_boost'] = 15
        
        # Calculate total
        scores['total_score'] = (
            scores['length_score'] + 
            scores['information_density'] + 
            min(scores['uniqueness_score'], 30) +  # Cap uniqueness at 30
            scores['recency_boost']
        )
        
        # Recommendation
        if scores['total_score'] >= 70:
            scores['recommendation'] = 'persist_l3_global'  # High value, persist to global
        elif scores['total_score'] >= 50:
            scores['recommendation'] = 'persist_l2_theme'   # Medium value, theme memory
        elif scores['total_score'] >= 30:
            scores['recommendation'] = 'persist_l1_log'     # Low value, just log
        else:
            scores['recommendation'] = 'skip'               # Skip
        
        return scores
    
    def _check_uniqueness(self, content: str, threshold: float = 0.7) -> Dict:
        """Check if content is unique compared to existing memories."""
        # Simple implementation - check for exact or near-exact matches
        content_hash = hashlib.md5(content.lower().strip().encode()).hexdigest()[:16]
        
        # Check against recent theme memories (simplified)
        for theme in self.list_themes()[:5]:  # Check last 5 themes
            memories = self.read_theme_memory(theme, hours_back=168)
            for mem in memories:
                existing = mem['content'].lower()
                # Simple similarity: check if content is substring
                if content.lower() in existing or existing in content.lower():
                    return {'score': 20, 'similar_to': [f"{theme}/{mem['filename']}"]}
                # Check word overlap for rough similarity
                content_words = set(content.lower().split())
                existing_words = set(existing.split())
                if content_words and existing_words:
                    overlap = len(content_words & existing_words) / max(len(content_words), len(existing_words))
                    if overlap > threshold:
                        return {'score': 40, 'similar_to': [f"{theme}/{mem['filename']}"]}
        
        return {'score': 100, 'similar_to': []}
    
    def smart_persist(self, content: str, theme: str = "auto", context: dict = None) -> Dict:
        """
        Smart persistence - quality check before writing.
        Auto-selects storage tier based on quality score.
        """
        # Score content
        quality = self.score_content_quality(content, context)
        
        result = {
            'quality_score': quality['total_score'],
            'recommendation': quality['recommendation'],
            'details': quality,
            'action_taken': None,
            'path': None,
        }
        
        # Auto-detect theme if needed
        if theme == "auto":
            theme = self._detect_theme(content)
        
        # Execute based on recommendation
        if quality['recommendation'] == 'persist_l3_global':
            self.write_global_memory(f"\n## {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n{content}")
            result['action_taken'] = 'written_to_global'
            result['path'] = self.l3_global_file
            
        elif quality['recommendation'] == 'persist_l2_theme':
            path = self.write_theme_memory(theme, content)
            result['action_taken'] = 'written_to_theme'
            result['path'] = path
            
        elif quality['recommendation'] == 'persist_l1_log':
            path = self.append_session_log('auto_captured', content)
            result['action_taken'] = 'logged_only'
            result['path'] = path
            
        else:
            result['action_taken'] = 'skipped_low_quality'
        
        return result
    
    # ========== Search & Retrieval ==========
    
    def search_memories(self, query: str, max_results: int = 10) -> List[Dict]:
        """Search across all memory tiers."""
        results = []
        query_lower = query.lower()
        
        # Search L3 Global
        global_content = self.read_global_memory()
        if query_lower in global_content.lower():
            # Find context around match
            idx = global_content.lower().find(query_lower)
            start = max(0, idx - 100)
            end = min(len(global_content), idx + 200)
            snippet = global_content[start:end]
            
            results.append({
                'tier': 'L3_GLOBAL',
                'type': 'global',
                'match': 'global.md',
                'snippet': snippet,
                'score': 100  # Global has highest priority
            })
        
        # Search L2 Themes
        for theme in self.list_themes():
            memories = self.read_theme_memory(theme, hours_back=720)  # 30 days
            
            for memory in memories:
                if query_lower in memory['content'].lower():
                    results.append({
                        'tier': 'L2_THEME',
                        'type': 'theme',
                        'theme': theme,
                        'timestamp': memory['timestamp'],
                        'match': f"{theme}/{memory['filename']}",
                        'snippet': memory['content'][:200] + '...',
                        'score': 50
                    })
                    
                    if len(results) >= max_results:
                        break
            
            if len(results) >= max_results:
                break
        
        # Sort by score (highest first)
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:max_results]
    
    # ========== Maintenance ==========
    
    def cleanup_old_memories(self, days_keep_l1: int = 30, days_keep_l2: int = 90) -> Dict:
        """
        Clean up old memories based on retention policy.
        - L1 (raw logs): archive after 30 days
        - L2 (themes): archive after 90 days
        """
        result = {
            'archived_l1': [],
            'archived_l2': [],
            'errors': []
        }
        
        archive_dir = os.path.join(self.memory_dir, "archive")
        os.makedirs(archive_dir, exist_ok=True)
        
        cutoff_l1 = datetime.datetime.now() - datetime.timedelta(days=days_keep_l1)
        cutoff_l2 = datetime.datetime.now() - datetime.timedelta(days=days_keep_l2)
        
        # Archive old L1 logs
        for filename in os.listdir(self.l1_sessions_dir):
            if not filename.endswith('.md'):
                continue
            try:
                date_str = filename.replace('.md', '')
                file_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
                
                if file_date < cutoff_l1:
                    src = os.path.join(self.l1_sessions_dir, filename)
                    dst = os.path.join(archive_dir, f"session_{filename}")
                    os.rename(src, dst)
                    result['archived_l1'].append(filename)
            except Exception as e:
                result['errors'].append(f"L1 {filename}: {str(e)}")
        
        # Archive old L2 theme files
        for theme in self.list_themes():
            theme_dir = os.path.join(self.l2_themes_dir, theme)
            for filename in os.listdir(theme_dir):
                if not filename.endswith('.md'):
                    continue
                try:
                    time_str = filename.replace('.md', '')
                    file_time = datetime.datetime.strptime(time_str, "%Y-%m-%d_%H")
                    
                    if file_time < cutoff_l2:
                        theme_archive = os.path.join(archive_dir, theme)
                        os.makedirs(theme_archive, exist_ok=True)
                        src = os.path.join(theme_dir, filename)
                        dst = os.path.join(theme_archive, filename)
                        os.rename(src, dst)
                        result['archived_l2'].append(f"{theme}/{filename}")
                except Exception as e:
                    result['errors'].append(f"L2 {theme}/{filename}: {str(e)}")
        
        return result


def main():
    """CLI interface for memory manager."""
    parser = argparse.ArgumentParser(
        description='Memory Manager for AI Agents - 3-tier memory system',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Session lifecycle
  %(prog)s session-init
  %(prog)s session-end --summary '{"key_decisions": 2}'
  
  # L1: Raw session logs
  %(prog)s log-turn --entry-type user --content "Hello"
  %(prog)s read-logs --days-back 7
  
  # L2: Theme-based memory
  %(prog)s quick-note --content "Refactored auth module" --auto-theme
  %(prog)s write-theme --theme agent-optimization --content "Changed delegation logic"
  %(prog)s read-theme --theme agent-optimization
  
  # L3: Global memory
  %(prog)s read-global
  %(prog)s write-global --content "User prefers TypeScript"
  
  # Smart features
  %(prog)s smart-capture --content "Fixed critical bug in parser" --context '{"is_error": true}'
  %(prog)s should-capture --user-msg "Wrong output" --agent-response "Error: timeout" --tools '["read", "edit"]' --turn-count 3
  %(prog)s score-quality --content "Decision: use Redis for caching"
  
  # Search & maintenance
  %(prog)s search --query "delegation"
  %(prog)s list-themes
  %(prog)s cleanup --days-keep-l1 30 --days-keep-l2 90
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # ========== Session Lifecycle ==========
    
    # Session init
    session_init_parser = subparsers.add_parser('session-init', help='Initialize session - load memories')
    session_init_parser.add_argument('--context', help='Session context JSON')
    
    # Session end
    session_end_parser = subparsers.add_parser('session-end', help='End session - generate summary')
    session_end_parser.add_argument('--summary', help='Session summary JSON')
    session_end_parser.add_argument('--no-distill', action='store_true', help='Skip auto-distillation')
    
    # ========== L1: Session Logs ==========
    
    # Log turn
    log_turn_parser = subparsers.add_parser('log-turn', help='Log a conversation turn to L1')
    log_turn_parser.add_argument('--entry-type', default='turn', help='Entry type')
    log_turn_parser.add_argument('--content', required=True, help='Content to log')
    log_turn_parser.add_argument('--tools', help='Tools used (JSON array)')
    log_turn_parser.add_argument('--session-id', help='Session identifier')
    
    # Read logs
    read_logs_parser = subparsers.add_parser('read-logs', help='Read L1 session logs')
    read_logs_parser.add_argument('--days-back', type=int, default=7, help='Days to look back')
    
    # ========== L2: Theme Memory ==========
    
    # Quick note
    quick_note_parser = subparsers.add_parser('quick-note', help='Quick capture with minimal friction')
    quick_note_parser.add_argument('--content', required=True, help='Note content')
    quick_note_parser.add_argument('--theme', default='misc', help='Theme name')
    quick_note_parser.add_argument('--auto-theme', action='store_true', help='Auto-detect theme')
    
    # Write theme
    write_theme_parser = subparsers.add_parser('write-theme', help='Write to theme memory')
    write_theme_parser.add_argument('--theme', required=True, help='Theme name')
    write_theme_parser.add_argument('--content', required=True, help='Content to write')
    write_theme_parser.add_argument('--template', choices=['decision', 'error', 'task'], help='Template type')
    
    # Read theme
    read_theme_parser = subparsers.add_parser('read-theme', help='Read theme memory')
    read_theme_parser.add_argument('--theme', required=True, help='Theme name')
    read_theme_parser.add_argument('--hours-back', type=int, default=24, help='Hours to look back')
    
    # ========== L3: Global Memory ==========
    
    read_global_parser = subparsers.add_parser('read-global', help='Read global memory')
    
    write_global_parser = subparsers.add_parser('write-global', help='Write to global memory')
    write_global_parser.add_argument('--content', required=True, help='Content to write')
    write_global_parser.add_argument('--append', action='store_true', help='Append to existing')
    
    # ========== Smart Features ==========
    
    # Smart capture
    smart_capture_parser = subparsers.add_parser('smart-capture', help='Quality-aware capture')
    smart_capture_parser.add_argument('--content', required=True, help='Content to capture')
    smart_capture_parser.add_argument('--theme', default='auto', help='Theme (auto for detection)')
    smart_capture_parser.add_argument('--context', help='Context JSON for scoring')
    
    # Should capture
    should_capture_parser = subparsers.add_parser('should-capture', help='Analyze if turn is worth capturing')
    should_capture_parser.add_argument('--user-msg', required=True, help='User message')
    should_capture_parser.add_argument('--agent-response', required=True, help='Agent response')
    should_capture_parser.add_argument('--tools', default='[]', help='Tools used (JSON array)')
    should_capture_parser.add_argument('--turn-count', type=int, required=True, help='Turn count')
    
    # Score quality
    score_quality_parser = subparsers.add_parser('score-quality', help='Score content quality')
    score_quality_parser.add_argument('--content', required=True, help='Content to score')
    score_quality_parser.add_argument('--context', help='Context JSON')
    
    # ========== Search & Maintenance ==========
    
    list_themes_parser = subparsers.add_parser('list-themes', help='List all themes')
    
    search_parser = subparsers.add_parser('search', help='Search memories')
    search_parser.add_argument('--query', required=True, help='Search query')
    search_parser.add_argument('--max-results', type=int, default=10, help='Max results')
    
    cleanup_parser = subparsers.add_parser('cleanup', help='Archive old memories')
    cleanup_parser.add_argument('--days-keep-l1', type=int, default=30, help='Days to keep L1')
    cleanup_parser.add_argument('--days-keep-l2', type=int, default=90, help='Days to keep L2')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    manager = MemoryManager()
    
    try:
        # ========== Session Lifecycle ==========
        
        if args.command == 'session-init':
            context = json.loads(args.context) if args.context else {}
            result = manager.session_init(context)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif args.command == 'session-end':
            summary = json.loads(args.summary) if args.summary else {}
            result = manager.session_end(summary, auto_distill=not args.no_distill)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        # ========== L1: Session Logs ==========
        
        elif args.command == 'log-turn':
            tools = json.loads(args.tools) if args.tools else []
            path = manager.append_session_log(
                entry_type=args.entry_type,
                content=args.content,
                tools_used=tools,
                session_id=args.session_id
            )
            print(json.dumps({'status': 'success', 'path': path}, ensure_ascii=False))
        
        elif args.command == 'read-logs':
            logs = manager.read_session_logs(days_back=args.days_back)
            print(json.dumps({'status': 'success', 'logs': logs}, ensure_ascii=False, indent=2))
        
        # ========== L2: Theme Memory ==========
        
        elif args.command == 'quick-note':
            result = manager.quick_note(
                content=args.content,
                theme=args.theme,
                auto_theme=args.auto_theme
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif args.command == 'write-theme':
            path = manager.write_theme_memory(
                theme=args.theme,
                content=args.content,
                template=args.template
            )
            print(json.dumps({'status': 'success', 'path': path}, ensure_ascii=False))
        
        elif args.command == 'read-theme':
            memories = manager.read_theme_memory(args.theme, hours_back=args.hours_back)
            print(json.dumps({'status': 'success', 'memories': memories}, ensure_ascii=False, indent=2))
        
        # ========== L3: Global Memory ==========
        
        elif args.command == 'read-global':
            content = manager.read_global_memory()
            print(json.dumps({'status': 'success', 'content': content}, ensure_ascii=False))
        
        elif args.command == 'write-global':
            manager.write_global_memory(args.content, args.append)
            print(json.dumps({'status': 'success'}, ensure_ascii=False))
        
        # ========== Smart Features ==========
        
        elif args.command == 'smart-capture':
            context = json.loads(args.context) if args.context else {}
            result = manager.smart_persist(args.content, args.theme, context)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif args.command == 'should-capture':
            tools = json.loads(args.tools) if args.tools else []
            should, cap_type, signals = manager.should_capture_from_turn(
                user_msg=args.user_msg,
                agent_response=args.agent_response,
                tools_used=tools,
                turn_count=args.turn_count
            )
            print(json.dumps({
                'should_capture': should,
                'capture_type': cap_type,
                'signals': signals
            }, ensure_ascii=False, indent=2))
        
        elif args.command == 'score-quality':
            context = json.loads(args.context) if args.context else {}
            result = manager.score_content_quality(args.content, context)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        # ========== Search & Maintenance ==========
        
        elif args.command == 'list-themes':
            themes = manager.list_themes()
            print(json.dumps({'status': 'success', 'themes': themes}, ensure_ascii=False))
        
        elif args.command == 'search':
            results = manager.search_memories(args.query, args.max_results)
            print(json.dumps({'status': 'success', 'results': results}, ensure_ascii=False, indent=2))
        
        elif args.command == 'cleanup':
            result = manager.cleanup_old_memories(args.days_keep_l1, args.days_keep_l2)
            print(json.dumps(result, ensure_ascii=False, indent=2))
    
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
