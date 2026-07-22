#!/bin/bash
# Daily Doc HTTP 本地开发服务器
# 用法: bash serve.sh [端口号，默认 8000]
# 启动后访问 http://localhost:8000

PORT=${1:-8000}
cd "$(dirname "$0")"

echo "=================================="
echo "  Daily Doc 本地 HTTP 服务器"
echo "  端口: $PORT"
echo "  地址: http://localhost:$PORT"
echo "  按 Ctrl+C 停止"
echo "=================================="

python3 -m http.server "$PORT"
