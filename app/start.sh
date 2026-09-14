#!/usr/bin/env bash
# Manual start alternative to the systemd service
# (the systemd service auto-starts this anyway)
exec python3 -m http.server 2203 --directory "$HOME/Work/iza/app" --bind 0.0.0.0