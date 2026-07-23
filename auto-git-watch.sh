#!/bin/bash
# auto-git-watch.sh — 监听备份目录，文件变更时自动 git add + commit + push
# 用法: ./auto-git-watch.sh [目标目录]
# 首次运行会自动 cd 到目标目录并初始化 git 操作

TARGET_DIR="${1:-$(pwd)}"
cd "$TARGET_DIR" || { echo "目录不存在: $TARGET_DIR"; exit 1; }

# 检查是否为 git 仓库
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "错误: $TARGET_DIR 不是 git 仓库"
  exit 1
fi

echo "监听目录: $TARGET_DIR"
echo "匹配文件: backup-*.json"
echo ""

# 防重复提交的冷却时间（秒）
COOLDOWN=10
LAST_COMMIT=0

export PATH="$PATH:/opt/homebrew/bin"
fswatch -0 --event Created --event Updated --event Renamed \
  --include 'backup-.*\.json$' \
  --exclude '\.git/' \
  "$TARGET_DIR" | while IFS= read -r -d '' file; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - LAST_COMMIT))

  if [ $ELAPSED -lt $COOLDOWN ]; then
    continue
  fi

  git add -A
  if git diff --cached --quiet; then
    continue
  fi

  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  git commit -m "auto-save: $TIMESTAMP"
  LAST_COMMIT=$(date +%s)
  echo "[$TIMESTAMP] 已提交"

  # 尝试推送
  if git push 2>/dev/null; then
    echo "  -> 已推送"
  else
    echo "  -> 推送失败（可能无网络或未配置 remote）"
  fi
done
