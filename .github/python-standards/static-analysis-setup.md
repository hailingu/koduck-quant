# Python Static Analysis & Quality Tools Setup

## Overview

This document describes the static code analysis and quality tools configured for Python projects to enforce **PEP 8**, **PEP 484** (type hints), and Python community best practices.

## Configured Tools

### 1. ruff (Linter + Formatter) ⭐ PRIMARY TOOL

**Purpose**: Ultra-fast Python linter and formatter. Replaces flake8, isort, pycodestyle, pyflakes, and more.

**Installation**:

```bash
pip install ruff
# or
uv add --dev ruff
```

**Configuration** (`pyproject.toml`):

```toml
[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort
    "N",    # pep8-naming
    "UP",   # pyupgrade
    "B",    # flake8-bugbear
    "SIM",  # flake8-simplify
    "ANN",  # flake8-annotations
    "S",    # flake8-bandit (security)
    "RUF",  # ruff-specific rules
]
ignore = [
    "ANN101",  # Missing type annotation for self
    "ANN102",  # Missing type annotation for cls
]

[tool.ruff.lint.isort]
known-first-party = ["myproject"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
docstring-code-format = true
```

**Usage**:

```bash
# Lint check
ruff check .

# Lint with auto-fix
ruff check --fix .

# Format check
ruff format --check .

# Format files
ruff format .
```

**Expected**: Zero lint violations, all files formatted.

**Note**: All Python code MUST be ruff-formatted before submission. This is non-negotiable.

---

### 2. mypy (Static Type Checker) ⭐ NON-NEGOTIABLE

**Purpose**: Verify type annotations are correct and consistent.

**Installation**:

```bash
pip install mypy
# or
uv add --dev mypy
```

**Configuration** (`pyproject.toml`):

```toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true

[[tool.mypy.overrides]]
module = ["tests.*"]
disallow_untyped_defs = false
```

**Usage**:

```bash
# Type check all source files
mypy src/

# Type check specific module
mypy src/myproject/service.py
```

**Expected**: Zero type errors on source code.

---

### 3. pytest (Testing Framework) ⭐ PRIMARY TEST TOOL

**Purpose**: Run tests, measure coverage, and validate behavior.

**Installation**:

```bash
pip install pytest pytest-cov pytest-asyncio
# or
uv add --dev pytest pytest-cov pytest-asyncio
```

**Configuration** (`pyproject.toml`):

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = [
    "-v",
    "--strict-markers",
    "--tb=short",
    "--cov=src/myproject",
    "--cov-report=term-missing",
    "--cov-fail-under=80",
]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests as integration tests",
]
asyncio_mode = "auto"
```

**Usage**:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/myproject --cov-report=term-missing

# Run specific test file
pytest tests/test_service.py

# Run specific test
pytest tests/test_service.py::TestGetUserByID::test_returns_user

# Run with verbose output
pytest -v

# Run excluding slow tests
pytest -m "not slow"
```

**Expected**: 100% tests pass, ≥ 80% coverage for business logic.

---

### 4. bandit (Security Scanner)

**Purpose**: Find common security issues in Python code.

**Installation**:

```bash
pip install bandit
# or included via ruff's "S" rule set
```

**Configuration** (`pyproject.toml`):

```toml
[tool.bandit]
exclude_dirs = ["tests"]
skips = ["B101"]  # Allow assert in non-test code if needed
```

**Usage**:

```bash
# Scan for security issues
bandit -r src/

# Or use ruff's built-in bandit rules
ruff check --select S .
```

**Expected**: Zero high-severity findings.

---

### 5. pre-commit (Git Hooks)

**Purpose**: Run quality checks automatically before commits.

**Installation**:

```bash
pip install pre-commit
pre-commit install
```

**Configuration** (`.pre-commit-config.yaml`):

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.14.0
    hooks:
      - id: mypy
        additional_dependencies: [types-all]

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-toml
      - id: check-added-large-files
```

---

## Validation Pipeline

### Full Quality Check Sequence

```bash
# 1. Format code
ruff format .

# 2. Lint check (with auto-fix)
ruff check --fix .

# 3. Type check
mypy src/

# 4. Run tests with coverage
pytest --cov=src/myproject --cov-report=term-missing

# 5. Security scan
bandit -r src/

# 6. IDE errors (in VS Code / Copilot)
# get_errors tool
```

### Priority Levels

| Level    | Issue Type                        | Action            |
| -------- | --------------------------------- | ----------------- |
| Critical | Type errors, security issues      | MUST fix          |
| High     | Uncaught exceptions, bare except  | Fix before review |
| Medium   | Style violations, missing types   | Fix or justify    |
| Low      | Convention preferences            | Nice to have      |

### Common Issues

- ❌ Missing type annotations on public functions
- ❌ Bare `except:` clause (must catch specific exceptions)
- ❌ Mutable default arguments (`def f(items=[])`)
- ❌ Unused imports or variables
- ❌ Missing docstrings on public classes/functions
- ❌ `type: ignore` without specific error code
- ❌ Hardcoded secrets or credentials
- ❌ SQL injection via string formatting

---

## Recommended pyproject.toml Template

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "myproject"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "pydantic>=2.0",
    "sqlalchemy>=2.0",
    "structlog>=24.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=6.0",
    "pytest-asyncio>=0.24",
    "mypy>=1.14",
    "ruff>=0.8",
    "bandit>=1.8",
    "pre-commit>=4.0",
]

[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "SIM", "ANN", "S", "RUF"]
ignore = ["ANN101", "ANN102"]

[tool.mypy]
python_version = "3.12"
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = ["-v", "--strict-markers", "--tb=short", "--cov=src/myproject"]
```
