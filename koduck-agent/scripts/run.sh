#!/bin/bash
# Koduck startup script (Unix/Linux/macOS)

set -e

# Color definitions using printf-compatible format
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    if [ -d ".venv" ]; then
        printf "${YELLOW}Activating virtual environment...${NC}\n"
        source .venv/bin/activate
    else
        printf "${RED}Error: Virtual environment not found${NC}\n"
        printf "Please run: uv venv --python 3.11\n"
        printf "Then: source .venv/bin/activate && pip install -e .\n"
        exit 1
    fi
fi

# Check dependencies
python3 -c "import yaml, anthropic" 2>/dev/null || {
    printf "${YELLOW}Installing dependencies...${NC}\n"
    # Prefer uv if available (faster and works with uv-created venvs)
    if command -v uv &> /dev/null; then
        uv pip install -e . --quiet || {
            printf "${RED}Failed to install dependencies with uv${NC}\n"
            exit 1
        }
    else
        python3 -m pip install -e . -q || {
            printf "${RED}Failed to install dependencies${NC}\n"
            exit 1
        }
    fi
}

# Check .env file
if [ ! -f ".env" ]; then
    printf "${YELLOW}Warning: .env file not found${NC}\n"
    printf "Please copy .env.template to .env and configure API key\n\n"
    read -p "Continue? (y/n) " -n 1 -r
    printf "\n"
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run koduck with command line args
python3 -m koduck "$@"
