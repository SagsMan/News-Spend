#!/bin/bash

set -e

echo "==========================================="
echo "  ccache Setup for React Native Android   "
echo "==========================================="

if command -v ccache &> /dev/null; then
    echo "ccache is already installed."
else
    echo "Installing ccache via Homebrew..."
    brew install ccache
    echo "ccache installed successfully."
fi

ccache --set-config=max_size=20G
echo "ccache max size configured to 20G"

echo ""
echo "Current ccache stats:"
ccache -s

echo ""
echo "==========================================="
echo "  ccache is ready for React Native Builds  "
echo "==========================================="
