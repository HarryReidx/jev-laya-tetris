#!/usr/bin/env bash
pkill -f "node server.js" 2>/dev/null && echo "Server stopped" || echo "No server running"
