"""
Centralized rate-limiter configuration for the Confidometer API.

Uses slowapi (a FastAPI wrapper around the `limits` library) with
in-memory storage. Switch to Redis for multi-instance deployments.

Key functions:
  - get_remote_address:  identifies callers by IP (public routes)
  - get_user_id_key:     identifies callers by JWT user ID (auth'd routes)
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

def get_user_id_key(request: Request) -> str:
    """
    Extract user identity from JWT for per-user rate limiting.
    Falls back to IP address if no authenticated user is found on request.state.
    """
    user = getattr(request.state, "current_user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    return get_remote_address(request)

# In-memory storage (default). For Redis: Limiter(key_func=..., storage_uri="redis://...")
limiter = Limiter(key_func=get_remote_address)

# ── Rate limit constants ──
RATE_AUTH       = "10/minute"    # Login, register — prevent brute force (generous for typos)
RATE_EXPENSIVE  = "20/minute"   # AI interview calls — protect paid APIs
RATE_UPLOAD     = "10/minute"   # File uploads — protect disk/bandwidth
RATE_SEARCH     = "3/minute"    # Job search trigger — protect external API quotas
RATE_STANDARD   = "60/minute"   # Data reads, polling — generous for all UI patterns
RATE_GLOBAL     = "120/minute"  # Default fallback for any undecorated endpoint
