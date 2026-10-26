#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ "$#" -eq 0 ]; then set -- run; fi
exec node dist/cli.js "$@"
