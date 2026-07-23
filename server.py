#!/usr/bin/env python3
"""Daily Doc 本地服务：静态文件 + git 同步接口"""
import http.server
import json
import os
import subprocess
import sys
import base64

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/git-sync":
            self._handle_git_sync()
        else:
            self.send_error(404)

    def _handle_git_sync(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)

            filename = data.get("filename", "")
            content = data.get("content", "")

            if not filename or not content:
                self._json_response(400, {"ok": False, "error": "缺少 filename 或 content"})
                return

            # 写入文件
            filepath = os.path.join(ROOT, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)

            # git add + commit
            subprocess.run(
                ["git", "add", filename],
                cwd=ROOT, capture_output=True, timeout=10
            )
            result = subprocess.run(
                ["git", "commit", "-m", f"sync: {filename}"],
                cwd=ROOT, capture_output=True, timeout=10
            )

            commit_done = result.returncode == 0

            # git push
            push_result = subprocess.run(
                ["git", "push"],
                cwd=ROOT, capture_output=True, timeout=30
            )

            push_done = push_result.returncode == 0
            push_msg = push_result.stderr.decode().strip() if push_result.stderr else ""

            self._json_response(200, {
                "ok": True,
                "committed": commit_done,
                "pushed": push_done,
                "detail": push_msg if not push_done else "ok"
            })

        except Exception as e:
            self._json_response(500, {"ok": False, "error": str(e)})

    def _json_response(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        # 精简日志
        if "/api/" in str(args):
            print(f"[{self.log_date_time_string()}] {args[0]}")


if __name__ == "__main__":
    addr = ("", PORT)
    httpd = http.server.HTTPServer(addr, Handler)
    print(f"Daily Doc 服务已启动: http://localhost:{PORT}")
    print(f"Git 同步接口: POST /api/git-sync")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
