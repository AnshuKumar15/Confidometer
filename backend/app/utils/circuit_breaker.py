"""
Circuit breaker and timeout utility for external dependencies (LLMs, TTS, Job APIs).
Prevents cascading failures and connection pool exhaustion when third-party services are degraded.
"""

import time
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Callable, Any

logger = logging.getLogger("circuit_breaker")

# Shared thread pool for offloading synchronous external calls with timeouts
_CB_EXECUTOR = ThreadPoolExecutor(max_workers=16, thread_name_prefix="cb_worker")


class CircuitBreakerOpenError(Exception):
    """Raised when an external dependency's circuit breaker is in OPEN state."""
    pass


class DependencyTimeoutError(Exception):
    """Raised when an external dependency call exceeds its timeout limit."""
    pass


class CircuitBreaker:
    """
    Standard three-state circuit breaker with timeout protection:
    - CLOSED: Normal operation. Requests pass through.
    - OPEN: Service is failing. Requests fail immediately with CircuitBreakerOpenError.
    - HALF_OPEN: Testing if service recovered by allowing a trial request.
    """

    STATE_CLOSED = "CLOSED"
    STATE_OPEN = "OPEN"
    STATE_HALF_OPEN = "HALF_OPEN"

    def __init__(
        self,
        name: str = "dependency",
        failure_threshold: int = 3,
        recovery_timeout: float = 30.0,
        default_timeout: float = 15.0
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.default_timeout = default_timeout

        self._state = self.STATE_CLOSED
        self._consecutive_failures = 0
        self._last_failure_time = 0.0
        self._last_state_change = time.time()
        self._lock = asyncio.Lock()

    @property
    def state(self) -> str:
        if self._state == self.STATE_OPEN:
            if time.time() - self._last_failure_time >= self.recovery_timeout:
                self._state = self.STATE_HALF_OPEN
                logger.info(f"[CircuitBreaker:{self.name}] Transitioned from OPEN to HALF_OPEN (probing recovery).")
        return self._state

    def _record_success(self):
        if self._state != self.STATE_CLOSED:
            logger.info(f"[CircuitBreaker:{self.name}] Recovered! State reset to CLOSED.")
        self._state = self.STATE_CLOSED
        self._consecutive_failures = 0

    def _record_failure(self, error: Exception):
        self._consecutive_failures += 1
        self._last_failure_time = time.time()
        logger.warning(
            f"[CircuitBreaker:{self.name}] Failure #{self._consecutive_failures}/{self.failure_threshold}: {error}"
        )
        if self._consecutive_failures >= self.failure_threshold:
            self._state = self.STATE_OPEN
            logger.error(
                f"[CircuitBreaker:{self.name}] TRIPPED TO OPEN! Fast-failing calls for {self.recovery_timeout}s."
            )

    async def call_async(self, coro_func: Callable, *args, timeout: float = None, **kwargs) -> Any:
        """Execute an asynchronous coroutine with circuit breaker state checks and timeout enforcement."""
        t_limit = timeout if timeout is not None else self.default_timeout

        if self.state == self.STATE_OPEN:
            raise CircuitBreakerOpenError(
                f"Circuit breaker for '{self.name}' is OPEN. Fast-failing request."
            )

        try:
            result = await asyncio.wait_for(coro_func(*args, **kwargs), timeout=t_limit)
            self._record_success()
            return result
        except asyncio.TimeoutError:
            err = DependencyTimeoutError(
                f"Dependency '{self.name}' timed out after {t_limit}s."
            )
            self._record_failure(err)
            raise err
        except Exception as e:
            self._record_failure(e)
            raise e

    def call_sync(self, func: Callable, *args, timeout: float = None, **kwargs) -> Any:
        """
        Execute a synchronous blocking function in a worker thread with timeout enforcement
        and circuit breaker protection.
        """
        t_limit = timeout if timeout is not None else self.default_timeout

        if self.state == self.STATE_OPEN:
            raise CircuitBreakerOpenError(
                f"Circuit breaker for '{self.name}' is OPEN. Fast-failing request."
            )

        future = _CB_EXECUTOR.submit(func, *args, **kwargs)
        try:
            result = future.result(timeout=t_limit)
            self._record_success()
            return result
        except FutureTimeoutError:
            err = DependencyTimeoutError(
                f"Dependency '{self.name}' timed out after {t_limit}s."
            )
            self._record_failure(err)
            raise err
        except Exception as e:
            self._record_failure(e)
            raise e


# Global singleton instances for core third-party dependencies
gemini_circuit_breaker = CircuitBreaker(
    name="Gemini-LLM",
    failure_threshold=3,
    recovery_timeout=30.0,
    default_timeout=15.0
)

tts_circuit_breaker = CircuitBreaker(
    name="Edge-TTS",
    failure_threshold=3,
    recovery_timeout=30.0,
    default_timeout=10.0
)
