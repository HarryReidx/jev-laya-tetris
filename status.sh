#!/usr/bin/env bash
echo "=== Node Server Process ==="
ps aux | grep "node server.js" | grep -v grep || echo "Server is not running"
echo "=== Health Endpoint ==="
curl -s http://127.0.0.1:8089/health
echo ""
