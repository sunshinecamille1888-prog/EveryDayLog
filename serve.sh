#!/bin/bash
# Daily Doc 一键启动：HTTP 服务 + git 自动备份监听
# 用法: bash serve.sh [端口号，默认 8000]

PORT=${1:-8000}
export PATH="$PATH:/opt/homebrew/bin"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# 检查端口是否已被占用
if lsof -i :$PORT -sTCP:LISTEN > /dev/null 2>&1; then
  echo "端口 $PORT 已被占用，直接打开浏览器"
  open "http://localhost:$PORT"
  exit 0
fi

echo "=================================="
echo "  Daily Doc"
echo "  地址: http://localhost:$PORT"
echo "  按 Ctrl+C 停止"
echo "=================================="

# 后台启动 git 自动监听（若 fswatch 已安装）
if command -v fswatch &> /dev/null; then
  bash "$DIR/auto-git-watch.sh" "$DIR" &
  WATCH_PID=$!
  echo "git 自动备份已启动 (PID: $WATCH_PID)"
fi

open "http://localhost:$PORT"
python3 -m http.server "$PORT"
