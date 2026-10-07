"""
Curated SQL Question Bank for Confidometer SQL Assessment.
Total: 200 verified questions (80 Easy, 80 Intermediate, 40 Hard).
Topics: SELECT, WHERE, JOIN, GROUP BY, HAVING, Subqueries, CTEs, Window Functions, Aggregates, ORDER BY / LIMIT
"""
import os
import json
import random
from typing import List, Dict, Any, Optional

_JSON_PATH = os.path.join(os.path.dirname(__file__), "sql_questions.json")
with open(_JSON_PATH, "r", encoding="utf-8") as _f:
    SQL_QUESTIONS: List[Dict[str, Any]] = json.load(_f)

TOPICS = [
    "SELECT", "WHERE", "JOIN", "GROUP BY", "HAVING",
    "Subqueries", "CTEs", "Window Functions", "Aggregates", "ORDER BY / LIMIT"
]

DIFFICULTIES = ["Easy", "Intermediate", "Hard"]

def get_sql_questions(
    difficulty: Optional[str] = "Intermediate",
    topics: Optional[List[str]] = None,
    count: int = 3
) -> List[Dict[str, Any]]:
    """
    Select `count` questions matching the given difficulty and topics.
    - If difficulty is None or not in Easy/Intermediate/Hard, defaults to 'Intermediate'.
    - If topics is empty or None, samples randomly across all topics.
    - User can select multiple topics.
    """
    if not difficulty or difficulty not in DIFFICULTIES:
        diff_filter = "Intermediate"
    else:
        diff_filter = difficulty

    # Filter by difficulty first
    pool = [q for q in SQL_QUESTIONS if q.get("difficulty", "").lower() == diff_filter.lower()]

    # If topics provided, filter pool
    if topics and len(topics) > 0:
        norm_topics = [t.strip().lower() for t in topics if t.strip()]
        topic_pool = [
            q for q in pool
            if any(t in q.get("topic", "").lower() for t in norm_topics)
        ]
        if len(topic_pool) >= count:
            pool = topic_pool
        elif len(topic_pool) > 0:
            remaining = [q for q in pool if q not in topic_pool]
            pool = topic_pool + random.sample(remaining, min(count - len(topic_pool), len(remaining)))

    if len(pool) < count:
        pool = SQL_QUESTIONS

    selected = random.sample(pool, min(count, len(pool)))
    return selected
