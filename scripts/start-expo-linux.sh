#!/usr/bin/env bash

set -e

# Vai para o diretório acima do script (equivalente ao cd /d "%~dp0..")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Primeiro argumento = profile
PROFILE="$1"

# Se não foi passado, usa default
if [ -z "$PROFILE" ]; then
  PROFILE="dev"
fi

# Remove o primeiro argumento (shift)
shift || true

# Executa o node com os demais argumentos
node scripts/start-expo-profile.js "$PROFILE" --android-local "$@"