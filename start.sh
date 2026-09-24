#!/usr/bin/env bash
cd /data/huangx/workspace/jev-laya-tetris

# Stop existing instance
pkill -f "node server.js" 2>/dev/null || true
sleep 1

# Start with nohup
mkdir -p logs
nohup node server.js > logs/server.log 2>&1 &
PID=$!
echo "Server started with PID: $PID"
sleep 2

# Check health
echo "Checking health..."
curl -s http://127.0.0.1:8089/health
echo ""
