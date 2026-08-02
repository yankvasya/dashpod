#!/bin/bash
# git pull happens in the workflow's SSH command, before this script is invoked — NOT in
# here. bash reads a script from disk as it executes it; if this script pulled its own
# new content mid-run, later lines would be read from the wrong file offset once the pull
# rewrote it underneath the running process (observed: it kept running the pre-pull
# version of this exact file after a pull that should have fixed the very bug it hit).
set -e

# Non-interactive SSH sessions (like this one) don't source ~/.bashrc, so nvm's PATH
# setup never runs and npm isn't found — load it explicitly and select the default version.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use default

cd ~/projects/dashpod

npm ci
npm run build

# Landing page (docs/) -> site root
rm -rf /var/snap/caddy/common/sites/dashpod/*
cp -r docs/* /var/snap/caddy/common/sites/dashpod/

# App (dist/) -> /app subpath
mkdir -p /var/snap/caddy/common/sites/dashpod/app
cp -r dist/* /var/snap/caddy/common/sites/dashpod/app/
