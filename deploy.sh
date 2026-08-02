#!/bin/bash
set -e
cd ~/projects/dashpod
git pull origin main
npm ci
npm run build
rm -rf /var/snap/caddy/common/sites/dashpod/*
cp -r dist/* /var/snap/caddy/common/sites/dashpod/
