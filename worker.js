// =============================================================================
// Cloudflare Worker — GitHub API 代理同步
// =============================================================================
// 部署说明：
// 1. 登录 https://dash.cloudflare.com → Workers & Pages → Create Worker
// 2. 将此文件内容粘贴到在线编辑器，点击 Deploy
// 3. 设置 GitHub Token 密钥：
//      npx wrangler secret put GITHUB_TOKEN
//     （或在 Dashboard → Worker → Settings → Variables → Add Secret）
// 4. 获取 Worker 域名（如 everydailylog-sync.<subdomain>.workers.dev）
// 5. 在 index.html 中设置：
//      <script>window.GIT_SYNC_URL = 'https://<your-worker>.<subdomain>.workers.dev/api/git-sync';</script>
//
// 依赖：无需 npm 安装任何包，Worker 内置 fetch + btoa
// =============================================================================

const GITHUB_REPO = 'sunshinecamille1888-prog/EveryDayLog';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/contents/`;

/**
 * 获取文件当前 sha（如果存在的话），不存在则返回 null
 */
async function getFileSha(filename, token) {
  const resp = await fetch(GITHUB_API + encodeURIComponent(filename), {
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'EveryDayLog-Worker',
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub GET ${filename}: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  return data.sha;
}

/**
 * 写文件到 GitHub（创建或更新）
 */
async function putFile(filename, content, token) {
  var sha = null;
  try {
    sha = await getFileSha(filename, token);
  } catch (e) {
    // 获取 sha 失败，尝试不带 sha 写入（文件可能不存在）
  }

  var body = {
    message: `sync: ${filename}`,
    content: btoa(unescape(encodeURIComponent(content)))
  };
  if (sha) body.sha = sha;

  const resp = await fetch(GITHUB_API + encodeURIComponent(filename), {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'EveryDayLog-Worker',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub PUT ${filename}: ${resp.status} ${err}`);
  }

  return resp.json();
}

export default {
  async fetch(request, env, ctx) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const url = new URL(request.url);

    // 仅处理 POST /api/git-sync
    if (request.method !== 'POST' || url.pathname !== '/api/git-sync') {
      return new Response(JSON.stringify({ ok: false, error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const token = env.GITHUB_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'GITHUB_TOKEN 未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    try {
      const data = await request.json();
      const filename = data.filename || '';
      const content = data.content || '';

      if (!filename || !content) {
        return new Response(JSON.stringify({ ok: false, error: '缺少 filename 或 content' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const result = await putFile(filename, content, token);

      return new Response(JSON.stringify({
        ok: true,
        committed: true,
        pushed: true,
        detail: `sha: ${result.content.sha}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
