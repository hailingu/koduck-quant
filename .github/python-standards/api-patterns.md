# Standard API Patterns for Python

**Purpose**: Provide standardized Python API design patterns ensuring consistency and best practices. Based on **PEP 8**, **PEP 484** (Type Hints), and Python community conventions.

**Version**: 1.0  
**Last Updated**: 2026-02-10

---

## Table of Contents

1. [Error Handling Patterns](#1-error-handling-patterns)
2. [Retry Strategy Patterns](#2-retry-strategy-patterns)
3. [HTTP Status Code Mapping](#3-http-status-code-mapping)
4. [Concurrency Patterns](#4-concurrency-patterns)
5. [Logging Patterns](#5-logging-patterns)
6. [Dependency Injection Patterns](#6-dependency-injection-patterns)

---

## 1. Error Handling Patterns

### Pattern 1.1: Custom Exception Hierarchy

**Rule**:

- **Domain/business errors** (expected) → Custom exception classes inheriting from `AppError`
- **Infrastructure errors** (unexpected) → Wrap with exception chaining (`from e`)
- **Input validation errors** → Custom `InvalidInputError` with details

**Example Contract Table**:

| Scenario           | Category       | Return Value   | Exception                             | HTTP Status |
| ------------------ | -------------- | -------------- | ------------------------------------- | ----------- |
| Resource not found | Domain         | N/A            | `UserNotFoundError(user_id)`          | 404         |
| Invalid input      | Validation     | N/A            | `InvalidInputError(detail)`           | 400 / 422   |
| DB timeout         | Infrastructure | N/A            | `DatabaseError(msg, cause=e)`         | 503         |
| DB unavailable     | Infrastructure | N/A            | `DatabaseError(msg, cause=e)`         | 503         |
| Duplicate resource | Domain         | N/A            | `DuplicateResourceError(field, value)`| 409         |

**Code Template**:

```python
"""Custom exception hierarchy for the application."""


class AppError(Exception):
    """Base exception for all application errors.

    Attributes:
        message: Human-readable error description.
        code: Machine-readable error code for API responses.
    """

    def __init__(self, message: str, *, code: str = "INTERNAL_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class UserNotFoundError(AppError):
    """Raised when a requested user does not exist.

    Attributes:
        user_id: The ID that was not found.
    """

    def __init__(self, user_id: str) -> None:
        super().__init__(f"User not found: {user_id}", code="USER_NOT_FOUND")
        self.user_id = user_id


class InvalidInputError(AppError):
    """Raised when input validation fails.

    Attributes:
        detail: Description of the validation failure.
    """

    def __init__(self, detail: str) -> None:
        super().__init__(f"Invalid input: {detail}", code="INVALID_INPUT")
        self.detail = detail


class DuplicateResourceError(AppError):
    """Raised when attempting to create a resource that already exists."""

    def __init__(self, field: str, value: str) -> None:
        super().__init__(
            f"Resource already exists: {field}={value}",
            code="DUPLICATE_RESOURCE",
        )
        self.field = field
        self.value = value


class DatabaseError(AppError):
    """Raised when a database operation fails (retryable)."""

    def __init__(self, message: str, *, cause: Exception | None = None) -> None:
        super().__init__(message, code="DATABASE_ERROR")
        if cause:
            self.__cause__ = cause
```

### Pattern 1.2: Service Method Error Handling

```python
class UserService:
    def get_user_by_id(self, user_id: str) -> User:
        """Retrieve a user by ID.

        Args:
            user_id: The UUID of the user.

        Returns:
            The User object.

        Raises:
            InvalidInputError: If user_id is empty or malformed.
            UserNotFoundError: If no user with the given ID exists.
            DatabaseError: If the database is unavailable.
        """
        # Input validation
        if not user_id:
            raise InvalidInputError("user_id must not be empty")

        if not is_valid_uuid(user_id):
            raise InvalidInputError(f"invalid UUID format: {user_id}")

        # Data access with infrastructure error wrapping
        try:
            user = self._repo.find_by_id(user_id)
        except OperationalError as e:
            raise DatabaseError(
                f"Failed to query user {user_id}", cause=e
            ) from e

        # Domain logic
        if user is None:
            raise UserNotFoundError(user_id)

        return user
```

---

## 2. Retry Strategy Patterns

### Pattern 2.1: Decorator-Based Retry with tenacity

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import logging

logger = logging.getLogger(__name__)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.1, min=0.1, max=2.0),
    retry=retry_if_exception_type(DatabaseError),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def get_user_with_retry(svc: UserService, user_id: str) -> User:
    """Get user with automatic retry on infrastructure errors."""
    return svc.get_user_by_id(user_id)
```

### Pattern 2.2: Manual Retry with Exponential Backoff

```python
import time
import logging

logger = logging.getLogger(__name__)

def get_user_with_retry(
    svc: UserService,
    user_id: str,
    *,
    max_retries: int = 3,
    initial_delay: float = 0.1,
) -> User:
    """Get user with manual retry logic.

    Args:
        svc: The user service instance.
        user_id: The user ID to fetch.
        max_retries: Maximum number of retry attempts.
        initial_delay: Initial delay in seconds between retries.

    Returns:
        The User object.

    Raises:
        UserNotFoundError: If user does not exist (not retried).
        InvalidInputError: If input is invalid (not retried).
        DatabaseError: If all retry attempts fail.
    """
    delay = initial_delay
    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            return svc.get_user_by_id(user_id)
        except (UserNotFoundError, InvalidInputError):
            raise  # Don't retry domain/validation errors
        except DatabaseError as e:
            last_error = e
            if attempt < max_retries:
                logger.warning(
                    "Attempt %d/%d failed, retrying in %.1fs: %s",
                    attempt + 1,
                    max_retries,
                    delay,
                    e,
                )
                time.sleep(delay)
                delay *= 2  # Exponential backoff
            else:
                logger.error(
                    "All %d attempts failed for user %s",
                    max_retries + 1,
                    user_id,
                )

    raise last_error  # type: ignore[misc]
```

---

## 3. HTTP Status Code Mapping

### Pattern 3.1: FastAPI Exception Handlers

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()


@app.exception_handler(UserNotFoundError)
async def user_not_found_handler(
    request: Request, exc: UserNotFoundError
) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"error": exc.code, "message": str(exc), "user_id": exc.user_id},
    )


@app.exception_handler(InvalidInputError)
async def invalid_input_handler(
    request: Request, exc: InvalidInputError
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": exc.code, "message": str(exc), "detail": exc.detail},
    )


@app.exception_handler(DatabaseError)
async def database_error_handler(
    request: Request, exc: DatabaseError
) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"error": exc.code, "message": "Service temporarily unavailable"},
    )


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": exc.code, "message": "Internal server error"},
    )
```

### Pattern 3.2: Exception-to-HTTP Mapping Table

```python
EXCEPTION_HTTP_MAP: dict[type[AppError], int] = {
    InvalidInputError: 400,
    UserNotFoundError: 404,
    DuplicateResourceError: 409,
    DatabaseError: 503,
    AppError: 500,  # Catch-all
}

def exception_to_status(exc: AppError) -> int:
    """Map exception type to HTTP status code."""
    for exc_type, status in EXCEPTION_HTTP_MAP.items():
        if isinstance(exc, exc_type):
            return status
    return 500
```

---

## 4. Concurrency Patterns

### Pattern 4.1: Async Service (FastAPI + asyncio)

```python
class AsyncUserService:
    """Async user service for use with FastAPI/asyncio."""

    def __init__(self, repo: AsyncUserRepository) -> None:
        self._repo = repo

    async def get_user_by_id(self, user_id: str) -> User:
        """Retrieve user by ID asynchronously."""
        if not user_id:
            raise InvalidInputError("user_id must not be empty")

        user = await self._repo.find_by_id(user_id)
        if user is None:
            raise UserNotFoundError(user_id)
        return user
```

### Pattern 4.2: Thread-Safe Service (Flask / Sync)

```python
import threading

class CachedUserService:
    """Thread-safe user service with caching."""

    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo
        self._cache: dict[str, User] = {}
        self._lock = threading.RLock()

    def get_user_by_id(self, user_id: str) -> User:
        # Check cache first (thread-safe read)
        with self._lock:
            cached = self._cache.get(user_id)
            if cached is not None:
                return cached

        # Fetch from repository
        user = self._repo.find_by_id(user_id)
        if user is None:
            raise UserNotFoundError(user_id)

        # Cache result (thread-safe write)
        with self._lock:
            self._cache[user_id] = user

        return user
```

---

## 5. Logging Patterns

### Pattern 5.1: Structured Logging with structlog

```python
import structlog

logger = structlog.get_logger()

class UserService:
    def get_user_by_id(self, user_id: str) -> User:
        log = logger.bind(user_id=user_id, operation="get_user_by_id")

        log.info("fetching_user")

        try:
            user = self._repo.find_by_id(user_id)
        except OperationalError as e:
            log.error("database_error", error=str(e))
            raise DatabaseError("DB unavailable", cause=e) from e

        if user is None:
            log.warning("user_not_found")
            raise UserNotFoundError(user_id)

        log.info("user_found", user_name=user.name)
        return user
```

### Pattern 5.2: Standard Library Logging

```python
import logging

logger = logging.getLogger(__name__)

class UserService:
    def get_user_by_id(self, user_id: str) -> User:
        logger.info("Fetching user", extra={"user_id": user_id})

        try:
            user = self._repo.find_by_id(user_id)
        except OperationalError:
            logger.exception("Database error fetching user %s", user_id)
            raise

        if user is None:
            logger.warning("User not found: %s", user_id)
            raise UserNotFoundError(user_id)

        return user
```

---

## 6. Dependency Injection Patterns

### Pattern 6.1: Constructor Injection (Recommended)

```python
class UserService:
    """Service with constructor injection."""

    def __init__(
        self,
        repo: UserRepository,
        cache: CacheService | None = None,
        event_publisher: EventPublisher | None = None,
    ) -> None:
        self._repo = repo
        self._cache = cache
        self._event_publisher = event_publisher
```

### Pattern 6.2: FastAPI Dependency Injection

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session

async def get_user_repo(
    session: AsyncSession = Depends(get_session),
) -> SQLAlchemyUserRepository:
    return SQLAlchemyUserRepository(session)

async def get_user_service(
    repo: SQLAlchemyUserRepository = Depends(get_user_repo),
) -> UserService:
    return UserService(repo)

@app.get("/users/{user_id}")
async def get_user(
    user_id: str,
    svc: UserService = Depends(get_user_service),
) -> UserResponse:
    user = await svc.get_user_by_id(user_id)
    return UserResponse.model_validate(user)
```

### Pattern 6.3: Protocol-Based Interfaces

```python
from typing import Protocol

class UserRepository(Protocol):
    """Repository interface using Protocol for structural subtyping."""

    def find_by_id(self, user_id: str) -> User | None: ...
    def save(self, user: User) -> User: ...
    def delete(self, user_id: str) -> bool: ...
    def find_by_email(self, email: str) -> User | None: ...


class AsyncUserRepository(Protocol):
    """Async repository interface."""

    async def find_by_id(self, user_id: str) -> User | None: ...
    async def save(self, user: User) -> User: ...
    async def delete(self, user_id: str) -> bool: ...
```
