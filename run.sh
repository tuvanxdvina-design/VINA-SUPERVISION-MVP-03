#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "VINA-SUPERVISION: http://localhost:8080"
python3 -m http.server 8080
