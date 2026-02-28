# Pythonic Python Guidelines & Best Practices

**Version**: 1.0  
**Last Updated**: 2026-02-10  
**Author**: Based on [PEP 8](https://peps.python.org/pep-0008/), [PEP 257](https://peps.python.org/pep-0257/), [PEP 484](https://peps.python.org/pep-0484/), and Python community best practices

---

## Table of Contents

1. [Naming Conventions](#1-naming-conventions)
2. [Package & Module Design](#2-package--module-design)
3. [Formatting](#3-formatting)
4. [Documentation & Docstrings](#4-documentation--docstrings)
5. [Type Hints](#5-type-hints)
6. [Control Structures](#6-control-structures)
7. [Functions & Methods](#7-functions--methods)
8. [Data Structures](#8-data-structures)
9. [Classes & Protocols](#9-classes--protocols)
10. [Concurrency & Async](#10-concurrency--async)
11. [Error Handling](#11-error-handling)
12. [Testing](#12-testing)
13. [Performance](#13-performance)

---

## 1. Naming Conventions

### 1.1 General Principles

#### Use snake_case for functions, variables, and modules; PascalCase for classes

✅ **Correct**:

```python
class UserService:
    pass

def get_user_by_id(user_id: str) -> User:
    pass

max_retry_count = 3
```

❌ **Incorrect**:

```python
class userService:  # Should be PascalCase
    pass

def GetUserById(userId):  # Should be snake_case
    pass

MaxRetryCount = 3  # Should be snake_case (not a class)
```

### 1.2 Module & Package Names

#### Modules should have short, lowercase names; avoid underscores when possible

✅ **Correct**:

```python
# File: user.py
# File: httputil.py
# Package: myapp/user/
```

❌ **Incorrect**:

```python
# File: UserService.py  # Should be lowercase
# File: HTTP_Client.py  # Should be lowercase, no underscores
```

### 1.3 Constants

#### Constants use UPPER_SNAKE_CASE

```python
MAX_RETRY_COUNT = 3
DEFAULT_TIMEOUT_SECONDS = 30
DATABASE_URL = "postgresql://localhost/mydb"
```

### 1.4 Private vs Public

#### Prefix with underscore for private; no underscore for public

```python
class UserService:
    def get_user(self, user_id: str) -> User:
        """Public method."""
        return self._fetch_from_db(user_id)

    def _fetch_from_db(self, user_id: str) -> User:
        """Private method - internal implementation."""
        ...
```

### 1.5 Dunder Methods

#### Double underscores for special methods only

```python
class User:
    def __init__(self, name: str, email: str) -> None:
        self.name = name
        self.email = email

    def __repr__(self) -> str:
        return f"User(name={self.name!r}, email={self.email!r})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, User):
            return NotImplemented
        return self.name == other.name and self.email == other.email
```

---

## 2. Package & Module Design

### 2.1 Project Structure

```
myproject/
├── pyproject.toml          # Project metadata and dependencies
├── src/
│   └── myproject/
│       ├── __init__.py
│       ├── py.typed         # PEP 561 marker
│       ├── models.py        # Data models (dataclasses/Pydantic)
│       ├── service.py       # Business logic
│       ├── repository.py    # Data access layer
│       ├── errors.py        # Custom exceptions
│       └── api/
│           ├── __init__.py
│           ├── routes.py    # API endpoints
│           └── schemas.py   # Request/Response schemas
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Shared fixtures
│   ├── test_service.py
│   └── test_repository.py
└── docs/
```

### 2.2 `__init__.py` Best Practices

```python
"""User management package.

Provides user CRUD operations with validation and error handling.
"""

from myproject.models import User
from myproject.service import UserService
from myproject.errors import UserNotFoundError, InvalidInputError

__all__ = [
    "User",
    "UserService",
    "UserNotFoundError",
    "InvalidInputError",
]
```

---

## 3. Formatting

### 3.1 Tools

- **Formatter**: `ruff format` (or `black`) — non-negotiable, all code MUST be auto-formatted
- **Linter**: `ruff check` (replaces flake8, isort, and more)
- **Import Sorting**: handled by `ruff` (isort-compatible rules)
- **Line Length**: 88 characters (ruff/black default)

### 3.2 Import Order

```python
# 1. Standard library
import os
import sys
from collections.abc import Sequence
from pathlib import Path

# 2. Third-party packages
import httpx
from pydantic import BaseModel
from sqlalchemy import select

# 3. Local/project imports
from myproject.errors import UserNotFoundError
from myproject.models import User
```

---

## 4. Documentation & Docstrings

### 4.1 Google-style Docstrings (Recommended)

```python
def get_user_by_id(user_id: str) -> User:
    """Retrieve a user by their unique identifier.

    Fetches the user from the database. Raises UserNotFoundError
    if no user exists with the given ID.

    Args:
        user_id: The UUID of the user to retrieve. Must be a valid
            UUID v4 string.

    Returns:
        The User object with all fields populated.

    Raises:
        UserNotFoundError: If no user exists with the given ID.
        InvalidInputError: If user_id is empty or not a valid UUID.
        DatabaseError: If the database is unavailable (retryable).

    Example:
        >>> svc = UserService(repo)
        >>> user = svc.get_user_by_id("123e4567-e89b-12d3-a456-426614174000")
        >>> print(user.name)
        'Alice'
    """
```

### 4.2 Module Docstrings

```python
"""User service module.

Provides business logic for user management operations including
creation, retrieval, update, and deletion. All operations are
validated and raise domain-specific exceptions.

Typical usage::

    from myproject.service import UserService
    from myproject.repository import SQLAlchemyUserRepository

    repo = SQLAlchemyUserRepository(session)
    svc = UserService(repo)
    user = svc.get_user_by_id("some-uuid")
"""
```

### 4.3 Class Docstrings

```python
class UserService:
    """User management service.

    Provides CRUD operations for user entities with input validation,
    error handling, and logging. Thread-safe for concurrent usage
    when backed by a thread-safe repository.

    Attributes:
        repo: The user repository for data persistence.
        logger: Structured logger instance.
    """
```

---

## 5. Type Hints

### 5.1 Modern Type Hints (Python 3.10+)

```python
# Use built-in generics (PEP 604, PEP 585)
def process_items(items: list[str]) -> dict[str, int]:
    ...

def find_user(user_id: str) -> User | None:
    ...

# Use collections.abc for abstract types
from collections.abc import Sequence, Mapping, Callable, AsyncIterator

def filter_users(users: Sequence[User], predicate: Callable[[User], bool]) -> list[User]:
    ...
```

### 5.2 Protocol (Structural Subtyping)

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class UserRepository(Protocol):
    """Repository interface for user persistence."""

    def find_by_id(self, user_id: str) -> User | None: ...
    def save(self, user: User) -> User: ...
    def delete(self, user_id: str) -> bool: ...
```

### 5.3 TypeVar and Generics

```python
from typing import TypeVar, Generic

T = TypeVar("T")

class Repository(Generic[T]):
    """Generic repository base class."""

    def find_by_id(self, entity_id: str) -> T | None: ...
    def save(self, entity: T) -> T: ...
```

---

## 6. Control Structures

### 6.1 Guard Clauses (Early Return)

```python
def get_user_by_id(self, user_id: str) -> User:
    if not user_id:
        raise InvalidInputError("user_id must not be empty")

    if not is_valid_uuid(user_id):
        raise InvalidInputError(f"invalid UUID format: {user_id}")

    user = self.repo.find_by_id(user_id)
    if user is None:
        raise UserNotFoundError(user_id)

    return user
```

### 6.2 Context Managers

```python
# Always use context managers for resource cleanup
from contextlib import contextmanager

@contextmanager
def get_db_session():
    session = SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

# Usage
with get_db_session() as session:
    user = session.query(User).get(user_id)
```

### 6.3 Comprehensions

```python
# Prefer comprehensions over map/filter for readability
active_names = [u.name for u in users if u.is_active]
user_by_id = {u.id: u for u in users}
unique_emails = {u.email for u in users}
```

---

## 7. Functions & Methods

### 7.1 Function Signatures

```python
# Use keyword-only arguments (after *) for clarity
def create_user(
    *,
    name: str,
    email: str,
    role: str = "user",
    is_active: bool = True,
) -> User:
    """Create a new user with the given attributes."""
    ...
```

### 7.2 Return Types

```python
# Always annotate return types
def find_user(user_id: str) -> User | None:  # Explicit None possibility
    ...

def list_users(*, page: int = 1, size: int = 20) -> list[User]:
    ...

# Use NamedTuple or dataclass for multiple returns
from typing import NamedTuple

class PaginatedResult(NamedTuple):
    items: list[User]
    total: int
    page: int
    pages: int
```

### 7.3 Dependency Injection

```python
class UserService:
    """User management service with injected dependencies."""

    def __init__(
        self,
        repo: UserRepository,
        cache: CacheService | None = None,
        logger: logging.Logger | None = None,
    ) -> None:
        self._repo = repo
        self._cache = cache
        self._logger = logger or logging.getLogger(__name__)
```

---

## 8. Data Structures

### 8.1 Dataclasses (Standard Library)

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class User:
    """Represents a system user."""

    id: str
    name: str
    email: str
    role: str = "user"
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    def validate(self) -> None:
        """Validate user fields.

        Raises:
            InvalidInputError: If any field has an invalid value.
        """
        if not self.name:
            raise InvalidInputError("name must not be empty")
        if not self.email or "@" not in self.email:
            raise InvalidInputError(f"invalid email: {self.email}")
```

### 8.2 Pydantic Models (For API/Validation)

```python
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    """Request schema for user creation."""

    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: str = Field(default="user", pattern=r"^(user|admin|moderator)$")

class UserResponse(BaseModel):
    """Response schema for user data."""

    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
```

---

## 9. Classes & Protocols

### 9.1 Abstract Base Classes vs Protocols

```python
# Prefer Protocol for structural typing (duck typing support)
from typing import Protocol

class Sendable(Protocol):
    def send(self, message: str) -> bool: ...

# Use ABC only when you need method implementations or registration
from abc import ABC, abstractmethod

class BaseRepository(ABC):
    @abstractmethod
    def find_by_id(self, entity_id: str) -> Any:
        ...

    def exists(self, entity_id: str) -> bool:
        """Default implementation using find_by_id."""
        return self.find_by_id(entity_id) is not None
```

### 9.2 Properties

```python
class User:
    def __init__(self, name: str, email: str) -> None:
        self._name = name
        self._email = email

    @property
    def name(self) -> str:
        """The user's display name."""
        return self._name

    @name.setter
    def name(self, value: str) -> None:
        if not value:
            raise InvalidInputError("name must not be empty")
        self._name = value
```

---

## 10. Concurrency & Async

### 10.1 asyncio (Preferred for I/O-Bound)

```python
import asyncio
import httpx

async def fetch_user(client: httpx.AsyncClient, user_id: str) -> User:
    """Fetch user from external API."""
    response = await client.get(f"/users/{user_id}")
    response.raise_for_status()
    return User(**response.json())

async def fetch_all_users(user_ids: list[str]) -> list[User]:
    """Fetch multiple users concurrently."""
    async with httpx.AsyncClient() as client:
        tasks = [fetch_user(client, uid) for uid in user_ids]
        return await asyncio.gather(*tasks)
```

### 10.2 Threading (For CPU-Bound with GIL Awareness)

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

class ThreadSafeCache:
    """Thread-safe in-memory cache using a lock."""

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}
        self._lock = threading.RLock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            return self._data.get(key)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = value
```

### 10.3 multiprocessing (For True Parallelism)

```python
from multiprocessing import Pool

def process_batch(items: list[dict]) -> list[Result]:
    """Process a batch of items in parallel."""
    with Pool() as pool:
        results = pool.map(process_single, items)
    return results
```

---

## 11. Error Handling

### 11.1 Custom Exception Hierarchy

```python
class AppError(Exception):
    """Base exception for application errors."""

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.code = code


class UserNotFoundError(AppError):
    """Raised when a requested user does not exist."""

    def __init__(self, user_id: str) -> None:
        super().__init__(f"User not found: {user_id}", code="USER_NOT_FOUND")
        self.user_id = user_id


class InvalidInputError(AppError):
    """Raised when input validation fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Invalid input: {detail}", code="INVALID_INPUT")
        self.detail = detail


class DatabaseError(AppError):
    """Raised when a database operation fails."""

    def __init__(self, message: str, *, cause: Exception | None = None) -> None:
        super().__init__(message, code="DATABASE_ERROR")
        self.__cause__ = cause
```

### 11.2 Error Handling Patterns

```python
# Use specific exception types — NEVER bare except
try:
    user = repo.find_by_id(user_id)
except UserNotFoundError:
    raise  # Re-raise domain errors
except sqlalchemy.exc.OperationalError as e:
    raise DatabaseError("Database unavailable", cause=e) from e
except Exception as e:
    logger.exception("Unexpected error in get_user")
    raise AppError(f"Internal error: {e}") from e
```

### 11.3 LBYL vs EAFP

```python
# Python prefers EAFP (Easier to Ask Forgiveness than Permission)
# ✅ Pythonic
try:
    value = data["key"]
except KeyError:
    value = default

# Also acceptable with .get()
value = data.get("key", default)

# ❌ Less Pythonic (LBYL)
if "key" in data:
    value = data["key"]
else:
    value = default
```

---

## 12. Testing

### 12.1 pytest Best Practices

```python
import pytest
from myproject.service import UserService
from myproject.errors import UserNotFoundError, InvalidInputError


class TestGetUserByID:
    """Tests for UserService.get_user_by_id."""

    def test_returns_user_when_found(self, user_service: UserService) -> None:
        user = user_service.get_user_by_id("valid-uuid")
        assert user.name == "Alice"
        assert user.email == "alice@example.com"

    def test_raises_not_found_when_missing(self, user_service: UserService) -> None:
        with pytest.raises(UserNotFoundError) as exc_info:
            user_service.get_user_by_id("nonexistent-uuid")
        assert exc_info.value.user_id == "nonexistent-uuid"

    def test_raises_invalid_input_when_empty(self, user_service: UserService) -> None:
        with pytest.raises(InvalidInputError, match="must not be empty"):
            user_service.get_user_by_id("")

    @pytest.mark.parametrize(
        "invalid_id",
        ["", "not-a-uuid", "12345", None],
        ids=["empty", "not-uuid", "numeric", "none"],
    )
    def test_raises_invalid_input_for_bad_ids(
        self, user_service: UserService, invalid_id: str
    ) -> None:
        with pytest.raises(InvalidInputError):
            user_service.get_user_by_id(invalid_id)
```

### 12.2 Fixtures & Mocking

```python
# conftest.py
import pytest
from unittest.mock import MagicMock
from myproject.service import UserService
from myproject.models import User


@pytest.fixture
def mock_repo() -> MagicMock:
    repo = MagicMock()
    repo.find_by_id.return_value = User(
        id="valid-uuid", name="Alice", email="alice@example.com"
    )
    return repo


@pytest.fixture
def user_service(mock_repo: MagicMock) -> UserService:
    return UserService(repo=mock_repo)
```

### 12.3 Async Testing

```python
import pytest

@pytest.mark.asyncio
async def test_async_get_user(async_user_service: AsyncUserService) -> None:
    user = await async_user_service.get_user_by_id("valid-uuid")
    assert user.name == "Alice"
```

---

## 13. Performance

### 13.1 Profiling

```python
# Use cProfile for CPU profiling
import cProfile

cProfile.run("main()", "output.prof")

# Use memory_profiler for memory
# @profile decorator
```

### 13.2 Common Optimizations

```python
# Use generators for large datasets
def process_large_file(path: Path) -> Iterator[Record]:
    with open(path) as f:
        for line in f:
            yield parse_record(line)

# Use __slots__ for memory-critical classes
class Point:
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

# Use functools.lru_cache for expensive computations
from functools import lru_cache

@lru_cache(maxsize=256)
def expensive_computation(n: int) -> int:
    ...
```

---

## Quick Reference

**Naming:**
- Modules/packages: lowercase, short: `user`, `httputil`
- Classes: PascalCase: `UserService`, `HTTPClient`
- Functions/variables: snake_case: `get_user_by_id`, `max_retries`
- Constants: UPPER_SNAKE_CASE: `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT`
- Private: prefix `_`: `_internal_method`, `_cache`

**Formatting:**
- Always use `ruff format` (or `black`) — never format manually
- Use `ruff check` for linting
- Line length: 88 characters
- Imports: sorted by `ruff` (isort-compatible)

**Type Hints:**
- All public functions MUST have type annotations
- Use modern syntax: `list[str]`, `dict[str, int]`, `str | None`
- Use `Protocol` for structural subtyping (duck typing)

**Error Handling:**
- Use custom exception hierarchy
- Never bare `except:` — always catch specific exceptions
- Use `from e` for exception chaining
- EAFP over LBYL when appropriate

**Testing:**
- pytest for all tests
- `pytest.raises` for exception testing
- `@pytest.mark.parametrize` for data-driven tests
- Fixtures for dependency injection in tests
- Target ≥ 90% coverage for business logic

**Documentation:**
- Google-style docstrings for all public items
- Module docstrings with usage examples
- Type hints complement (not replace) docstrings

---

**Remember**: When in doubt, consult [PEP 8](https://peps.python.org/pep-0008/), [PEP 257](https://peps.python.org/pep-0257/), and the [Python documentation](https://docs.python.org/3/) for authoritative guidance.
