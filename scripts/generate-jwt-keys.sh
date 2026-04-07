#!/bin/bash
# Generate JWT RSA key pair for koduck-auth

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYS_DIR="$(dirname "$SCRIPT_DIR")/koduck-auth/keys"

echo "=== Generating JWT RSA Key Pair ==="
echo "Keys directory: $KEYS_DIR"
echo ""

# Create keys directory if not exists
mkdir -p "$KEYS_DIR"

# Check if keys already exist
if [ -f "$KEYS_DIR/private.pem" ] && [ -f "$KEYS_DIR/public.pem" ]; then
    echo "WARNING: Keys already exist!"
    read -p "Do you want to overwrite them? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Generate private key
echo "Generating 2048-bit RSA private key..."
openssl genrsa -out "$KEYS_DIR/private.pem" 2048

# Generate public key
echo "Extracting public key..."
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

# Set permissions
echo "Setting key permissions..."
chmod 600 "$KEYS_DIR/private.pem"
chmod 644 "$KEYS_DIR/public.pem"

echo ""
echo "=== Key Generation Complete ==="
echo "Private key: $KEYS_DIR/private.pem"
echo "Public key:  $KEYS_DIR/public.pem"
echo ""

# Generate base64 encoded versions for K8s secret
echo "Generating Base64 encoded versions for K8s secret..."
PRIVATE_B64=$(base64 -i "$KEYS_DIR/private.pem" | tr -d '\n')
PUBLIC_B64=$(base64 -i "$KEYS_DIR/public.pem" | tr -d '\n')

echo ""
echo "=== K8s Secret Data (base64) ==="
echo "private.pem: $PRIVATE_B64"
echo "public.pem:  $PUBLIC_B64"
echo ""

echo "You can update the K8s secret with these values."
