/**
 * Generates automated scripts and Chrome Extension source code for extracting Greenhouse jobs and links.
 */

export function generatePythonScript(board: string = "synack", jobId: string = "8023991"): string {
  return `#!/usr/bin/env python3
"""
Greenhouse Job Description & Link Extractor
Automatically queries Greenhouse JSON API with fallback to company feed and Wayback Machine archives.
Extracts all embedded application links, emails, and external references.
"""

import re
import html
import json
import urllib.parse
import urllib.request
import sys

def extract_links_from_text(html_content, plain_text):
    """Extracts all URLs, mailto links, and action buttons from job content."""
    links = []
    seen = set()

    # 1. Match HTML hrefs
    a_matches = re.findall(r'<a\\s+(?:[^>]*?\\s+)?href=["\\'](.*?)["\\'][^>]*?>(.*?)</a>', html_content, re.IGNORECASE | re.DOTALL)
    for url, text in a_matches:
        url = html.unescape(url.strip())
        clean_text = html.unescape(re.sub(r'<[^>]+>', '', text).strip()) or url
        if url and not url.startswith(('javascript:', '#')) and url not in seen:
            seen.add(url)
            links.append({'url': url, 'text': clean_text, 'type': categorize_url(url)})

    # 2. Match raw text URLs
    raw_urls = re.findall(r'(https?://[^\\s<>"\\'{}|\\\\^\`\\[\\]]+)', plain_text)
    for raw in raw_urls:
        raw = raw.rstrip('.,;:)')
        if raw not in seen:
            seen.add(raw)
            links.append({'url': raw, 'text': raw, 'type': categorize_url(raw)})

    # 3. Match emails
    emails = re.findall(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})', plain_text)
    for email in emails:
        mailto = f"mailto:{email}"
        if mailto not in seen:
            seen.add(mailto)
            links.append({'url': mailto, 'text': email, 'type': 'email'})

    return links

def categorize_url(url):
    u = url.lower()
    if u.startswith('mailto:'): return 'email'
    if 'forms.gle' in u or 'docs.google.com/forms' in u or 'typeform' in u: return 'form'
    if 'calendly.com' in u or 'chili_piper' in u: return 'meeting'
    if 'drive.google.com' in u or '.pdf' in u or '.docx' in u: return 'document'
    if 'linkedin.com' in u or 'github.com' in u: return 'social'
    if 'apply' in u or 'jobs/' in u: return 'apply'
    return 'external'

def fetch_json(url):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception:
        return None

def fetch_text(url):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read().decode('utf-8')
    except Exception:
        return None

def get_greenhouse_job(board, job_id=None):
    print(f"[*] Checking Greenhouse API for board: '{board}', job_id: '{job_id}'...")

    # Step 1: Direct Job Endpoint
    if job_id:
        direct_url = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{job_id}"
        data = fetch_json(direct_url)
        if data:
            print("[+] SUCCESS: Found active job via Greenhouse direct API!")
            return parse_job_payload(data, source="Greenhouse Direct API")

    # Step 2: Feed endpoint (all jobs on board)
    print("[*] Checking company-wide board feed...")
    board_feed_url = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true"
    feed_data = fetch_json(board_feed_url)
    if feed_data and "jobs" in feed_data:
        jobs = feed_data["jobs"]
        print(f"[*] Found {len(jobs)} active jobs on board '{board}'.")
        if job_id:
            for j in jobs:
                if str(j.get("id")) == str(job_id):
                    print("[+] SUCCESS: Found matching job in board feed!")
                    return parse_job_payload(j, source="Greenhouse Board Feed API")

    # Step 3: Wayback Machine Internet Archive Fallback
    if job_id:
        print("[*] Job not currently active. Searching Internet Archive (Wayback Machine)...")
        test_urls = [
            f"https://job-boards.greenhouse.io/{board}/jobs/{job_id}",
            f"https://boards.greenhouse.io/{board}/jobs/{job_id}"
        ]
        for target_url in test_urls:
            cdx_url = f"https://web.archive.org/cdx/search/cdx?url={urllib.parse.quote(target_url)}&output=json&limit=3&fl=timestamp,original"
            cdx_data = fetch_json(cdx_url)
            if cdx_data and len(cdx_data) > 1:
                latest = cdx_data[-1]
                timestamp, original = latest[0], latest[1]
                archive_url = f"https://web.archive.org/web/{timestamp}if_/{original}"
                print(f"[+] Found Wayback Machine snapshot from {timestamp}!")
                html_raw = fetch_text(archive_url)
                if html_raw:
                    return parse_archived_html(html_raw, job_id, f"https://web.archive.org/web/{timestamp}/{original}")

    print("[-] Job could not be found via live API or Wayback archive.")
    return None

def parse_job_payload(data, source):
    title = data.get("title", "Unknown Title")
    raw_content = data.get("content", "")
    decoded_html = html.unescape(raw_content)
    plain_text = re.sub(r'<[^>]+>', ' ', decoded_html)
    plain_text = re.sub(r'\\s+', ' ', plain_text).strip()
    links = extract_links_from_text(decoded_html, plain_text)

    return {
        "source": source,
        "id": data.get("id"),
        "title": title,
        "location": data.get("location", {}).get("name", "N/A"),
        "updated_at": data.get("updated_at"),
        "plain_text": plain_text,
        "extracted_links": links
    }

def parse_archived_html(html_raw, job_id, archive_url):
    title_match = re.search(r'<h1[^>]*app-title[^>]*>(.*?)</h1>', html_raw, re.IGNORECASE) or re.search(r'<h1[^>]*>(.*?)</h1>', html_raw, re.IGNORECASE)
    title = html.unescape(re.sub(r'<[^>]+>', '', title_match.group(1)).strip()) if title_match else f"Archived Job #{job_id}"
    
    plain_text = re.sub(r'<script.*?</script>', '', html_raw, flags=re.DOTALL | re.IGNORECASE)
    plain_text = re.sub(r'<style.*?</style>', '', plain_text, flags=re.DOTALL | re.IGNORECASE)
    plain_text = html.unescape(re.sub(r'<[^>]+>', ' ', plain_text))
    plain_text = re.sub(r'\\s+', ' ', plain_text).strip()
    
    links = extract_links_from_text(html_raw, plain_text)

    return {
        "source": f"Wayback Archive ({archive_url})",
        "id": job_id,
        "title": title,
        "location": "See description",
        "archive_url": archive_url,
        "plain_text": plain_text[:2000] + "...",
        "extracted_links": links
    }

if __name__ == "__main__":
    board_arg = "${board}"
    job_id_arg = "${jobId}"
    if len(sys.argv) > 1:
        board_arg = sys.argv[1]
    if len(sys.argv) > 2:
        job_id_arg = sys.argv[2]

    res = get_greenhouse_job(board_arg, job_id_arg)
    if res:
        print("\\n" + "="*60)
        print(f"TITLE:    {res['title']}")
        print(f"SOURCE:   {res['source']}")
        print(f"LOCATION: {res.get('location', 'N/A')}")
        print("="*60)
        print(f"\\n--- EXTRACTED LINKS ({len(res['extracted_links'])} found) ---")
        for i, link in enumerate(res['extracted_links'], 1):
            print(f"[{i}] [{link['type'].upper()}] {link['text']} -> {link['url']}")
        print("\\n--- JOB DESCRIPTION PREVIEW ---")
        print(res['plain_text'][:800] + "\\n...")
`;
}

export function generateNodeScript(board: string = "synack", jobId: string = "8023991"): string {
  return `/**
 * Greenhouse Job Description & Link Extractor (Node.js ESM)
 * Run with: node extract.js [board] [jobId]
 */

import https from 'node:https';

const board = process.argv[2] || '${board}';
const jobId = process.argv[3] || '${jobId}';

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve({ ok: true, data: JSON.parse(data), raw: data }); }
          catch { resolve({ ok: true, raw: data }); }
        } else {
          resolve({ ok: false, status: res.statusCode });
        }
      });
    }).on('error', () => resolve({ ok: false }));
  });
}

function extractLinks(html, text) {
  const links = [];
  const seen = new Set();

  const aRegex = /<a\\s+(?:[^>]*?\\s+)?href=["'](.*?)["'][^>]*?>([\\s\\S]*?)<\\/a>/gi;
  let match;
  while ((match = aRegex.exec(html)) !== null) {
    const url = match[1].trim();
    const anchorText = match[2].replace(/<[^>]+>/g, '').trim() || url;
    if (url && !url.startsWith('#') && !seen.has(url)) {
      seen.add(url);
      links.push({ url, text: anchorText });
    }
  }

  const rawUrls = text.match(/(https?:\\/\\/[^\\s<>"'{}|\\\\^[\\]]+)/gi) || [];
  for (const raw of rawUrls) {
    const clean = raw.replace(/[.,;:)\]]+$/, '');
    if (!seen.has(clean)) {
      seen.add(clean);
      links.push({ url: clean, text: clean });
    }
  }
  return links;
}

async function main() {
  console.log(\`Searching Greenhouse API for \${board} (Job ID: \${jobId})...\`);
  
  // 1. Direct API
  const directApi = \`https://boards-api.greenhouse.io/v1/boards/\${board}/jobs/\${jobId}\`;
  const directRes = await fetchUrl(directApi);
  if (directRes.ok && directRes.data) {
    const job = directRes.data;
    console.log(\`\\n[SUCCESS] Found live job: \${job.title}\`);
    const links = extractLinks(job.content || '', job.content || '');
    console.log(\`Extracted \${links.length} links:\`);
    links.forEach((l, idx) => console.log(\`  [\${idx + 1}] \${l.text} -> \${l.url}\`));
    return;
  }

  // 2. Wayback Machine Archive Check
  console.log('Direct API failed. Querying Internet Archive Wayback Machine...');
  const cdx = \`https://web.archive.org/cdx/search/cdx?url=job-boards.greenhouse.io/\${board}/jobs/\${jobId}&output=json&limit=3\`;
  const cdxRes = await fetchUrl(cdx);
  if (cdxRes.ok && Array.isArray(cdxRes.data) && cdxRes.data.length > 1) {
    const [timestamp, orig] = [cdxRes.data[1][0], cdxRes.data[1][1]];
    const archiveUrl = \`https://web.archive.org/web/\${timestamp}if_/\${orig}\`;
    console.log(\`\\n[RECOVERED] Found Wayback Snapshot (\${timestamp}): \${archiveUrl}\`);
    const pageRes = await fetchUrl(archiveUrl);
    if (pageRes.ok) {
      const links = extractLinks(pageRes.raw, pageRes.raw);
      console.log(\`Extracted \${links.length} embedded links from archived description.\`);
      links.forEach((l, idx) => console.log(\`  [\${idx + 1}] \${l.text} -> \${l.url}\`));
      return;
    }
  }

  console.log('Job could not be retrieved from active API or Wayback archive.');
}

main();
`;
}

export function generateCurlCommand(board: string = "synack", jobId: string = "8023991"): string {
  return `# 1. Fetch direct job description (JSON)
curl -s "https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}" | jq .

# 2. Fetch all published roles with full HTML content
curl -s "https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true" | jq '.jobs[] | {id: .id, title: .title, location: .location.name}'

# 3. Check Wayback Machine for expired / deleted posting
curl -s "https://web.archive.org/cdx/search/cdx?url=job-boards.greenhouse.io/${board}/jobs/${jobId}&output=json" | jq .
`;
}

export function generateBookmarklet(): string {
  return `javascript:(function(){
  const url = window.location.href;
  const match = url.match(/(?:job-boards|boards|boards-api)\\.greenhouse\\.io\\/([^/]+)\\/jobs\\/(\\d+)/) ||
                url.match(/[?&]for=([^&]+).*?[?&]token=(\\d+)/);
  
  const board = match ? match[1] : prompt("Enter Greenhouse Board Token (e.g. synack):", "synack");
  const jobId = match ? match[2] : prompt("Enter Job ID (e.g. 8023991):", "8023991");
  
  if(!board) return;

  const overlay = document.createElement("div");
  overlay.id = "gh-floating-extractor";
  overlay.style.cssText = "position:fixed;bottom:24px;right:24px;width:420px;max-height:85vh;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);z-index:999999999;font-family:system-ui,-apple-system,sans-serif;padding:20px;overflow-y:auto;";
  
  overlay.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #334155;padding-bottom:8px;"><strong style="font-size:15px;color:#38bdf8;">Greenhouse API Extractor</strong><button id="gh-close-btn" style="background:#334155;border:none;color:#fff;border-radius:6px;padding:4px 8px;cursor:pointer;">✕</button></div><div id="gh-body" style="font-size:13px;line-height:1.5;color:#94a3b8;">Querying Greenhouse API & Archives for <b>' + board + '</b> (' + (jobId||'all') + ')...</div>';
  document.body.appendChild(overlay);
  
  document.getElementById("gh-close-btn").onclick = () => overlay.remove();

  const apiUrl = "https://boards-api.greenhouse.io/v1/boards/" + board + "/jobs/" + (jobId || "");
  fetch(apiUrl)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(job => {
      const links = Array.from((job.content || '').matchAll(/href=["'](.*?)["']/g)).map(m => m[1]);
      document.getElementById("gh-body").innerHTML = '<div style="color:#22c55e;font-weight:bold;margin-bottom:6px;">✓ Live Job Found: ' + (job.title||'Role') + '</div><div style="color:#cbd5e1;margin-bottom:10px;">Location: ' + (job.location?.name||'N/A') + '</div><div style="font-weight:bold;margin-top:10px;color:#38bdf8;">Extracted Links (' + links.length + '):</div><div style="max-height:140px;overflow-y:auto;background:#1e293b;padding:8px;border-radius:8px;margin-top:6px;word-break:break-all;">' + (links.length ? links.map(l => '<div style="margin-bottom:4px;"><a href="' + l + '" target="_blank" style="color:#60a5fa;text-decoration:none;">🔗 ' + l + '</a></div>').join('') : 'No embedded links') + '</div>';
    })
    .catch(() => {
      const cdxUrl = "https://web.archive.org/cdx/search/cdx?url=job-boards.greenhouse.io/" + board + "/jobs/" + jobId + "&output=json&limit=2";
      fetch(cdxUrl)
        .then(r => r.json())
        .then(cdx => {
          if(cdx && cdx.length > 1) {
            const snap = cdx[1][0];
            const arch = "https://web.archive.org/web/" + snap + "/https://job-boards.greenhouse.io/" + board + "/jobs/" + jobId;
            document.getElementById("gh-body").innerHTML = '<div style="color:#f59e0b;font-weight:bold;">⚠ Posting Expired (Found in Archive!)</div><p style="margin:8px 0;">This job was unpublished, but an archive snapshot exists:</p><a href="' + arch + '" target="_blank" style="display:inline-block;background:#3b82f6;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:4px;">Open Wayback Snapshot ↗</a>';
          } else {
            document.getElementById("gh-body").innerHTML = '<div style="color:#ef4444;">✕ Job ' + jobId + ' not found in active API or Wayback Archive.</div><div style="margin-top:8px;"><a href="https://boards-api.greenhouse.io/v1/boards/' + board + '/jobs?content=true" target="_blank" style="color:#38bdf8;">View all current ' + board + ' jobs JSON ↗</a></div>';
          }
        })
        .catch(() => {
          document.getElementById("gh-body").innerHTML = '<div style="color:#ef4444;">Failed to query API/archive.</div>';
        });
    });
})();`;
}

/**
 * Manifest V3 Extension Files (Non-sidebar: Floating Badge + Modal Overlay HUD)
 */
export const EXTENSION_FILES = {
  manifest: `{
  "manifest_version": 3,
  "name": "Greenhouse Job & Link Auto-Extractor",
  "version": "2.0.0",
  "description": "Automatically recovers Greenhouse job descriptions and extracts embedded application links upon page load without using extension sidebars.",
  "permissions": ["activeTab", "storage"],
  "host_permissions": [
    "https://*.greenhouse.io/*",
    "https://job-boards.greenhouse.io/*",
    "https://boards.greenhouse.io/*",
    "https://boards-api.greenhouse.io/*",
    "https://web.archive.org/*",
    "https://archive.org/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Greenhouse Auto-Extractor"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.greenhouse.io/*",
        "*://job-boards.greenhouse.io/*",
        "*://boards.greenhouse.io/*"
      ],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_idle"
    }
  ],
  "commands": {
    "toggle-inspector": {
      "suggested_key": {
        "default": "Ctrl+Shift+G",
        "mac": "Command+Shift+G"
      },
      "description": "Toggle Greenhouse Floating Inspector"
    }
  }
}`,

  contentScript: `// content.js - Zero-Input Automatic Greenhouse Job & Link Extractor (Non-Sidebar)
(function () {
  if (window.__gh_extractor_initialized) return;
  window.__gh_extractor_initialized = true;

  // 1. AUTOMATIC PARAMETER EXTRACTION (No manual typing required)
  function detectJobContext() {
    const url = window.location.href;
    const referrer = document.referrer || '';

    // Regex matchers for greenhouse job URLs
    const jobUrlMatch = url.match(/(?:job-boards|boards|boards-api)\\.greenhouse\\.io\\/([^/?#]+)(?:\\/jobs\\/(\\d+))?/i) ||
                        url.match(/greenhouse\\.io\\/([^/?#]+)(?:\\/jobs\\/(\\d+))?/i);

    let board = jobUrlMatch ? jobUrlMatch[1] : null;
    let jobId = jobUrlMatch && jobUrlMatch[2] ? jobUrlMatch[2] : null;

    // Check query params if not in path (e.g. ?for=synack&token=8023991 or gh_jid=8023991)
    const urlParams = new URLSearchParams(window.location.search);
    if (!jobId) {
      jobId = urlParams.get('gh_jid') || urlParams.get('token') || urlParams.get('job_id');
    }
    if (!board) {
      board = urlParams.get('for') || urlParams.get('board') || window.location.pathname.split('/')[1] || 'synack';
    }

    // Check referrer if Greenhouse redirected from a specific job 404
    if (!jobId && referrer) {
      const refMatch = referrer.match(/(?:job-boards|boards)\\.greenhouse\\.io\\/([^/?#]+)\\/jobs\\/(\\d+)/i);
      if (refMatch) {
        board = refMatch[1];
        jobId = refMatch[2];
      }
    }

    // Default clean board if not parsed
    if (!board || board === 'jobs') board = 'synack';

    return { board, jobId, url };
  }

  // 2. CREATE NON-SIDEBAR IN-PAGE UI (Floating HUD & In-Page Banner)
  // Ensures 0 conflict with user's existing sidebar extensions!
  const uiContainer = document.createElement('div');
  uiContainer.id = 'gh-auto-extractor-root';
  uiContainer.innerHTML = \`
    <!-- Floating Bottom-Right Pill -->
    <div id="gh-pill-trigger" title="Click to expand Greenhouse Job & Link Inspector">
      <div class="gh-pill-glow"></div>
      <div class="gh-pill-body">
        <span class="gh-pill-icon">⚡</span>
        <span class="gh-pill-label" id="gh-pill-status">Extracting Job...</span>
        <span class="gh-pill-count" id="gh-pill-badge" style="display:none;">0 links</span>
      </div>
    </div>

    <!-- Center In-Page Floating Modal (NOT A SIDEBAR) -->
    <div id="gh-hud-overlay" style="display: none;">
      <div class="gh-hud-backdrop" id="gh-hud-dismiss"></div>
      <div class="gh-hud-card">
        <div class="gh-hud-header">
          <div class="gh-hud-title-group">
            <div class="gh-hud-icon-box">⚡</div>
            <div>
              <h3 class="gh-hud-title">Greenhouse Auto-Extractor</h3>
              <p class="gh-hud-subtitle" id="gh-hud-board-tag">Auto-detected from URL</p>
            </div>
          </div>
          <div class="gh-hud-actions">
            <button class="gh-hud-btn-copy" id="gh-copy-all-btn" title="Copy Job Description & Links">📋 Copy All</button>
            <button class="gh-hud-btn-close" id="gh-close-hud" title="Close">✕</button>
          </div>
        </div>

        <div class="gh-hud-content" id="gh-hud-main-content">
          <div class="gh-loader-box">
            <div class="gh-spinner"></div>
            <p>Automatically querying Greenhouse API & Wayback archives...</p>
          </div>
        </div>
      </div>
    </div>
  \`;
  document.body.appendChild(uiContainer);

  const pill = document.getElementById('gh-pill-trigger');
  const overlay = document.getElementById('gh-hud-overlay');
  const closeBtn = document.getElementById('gh-close-hud');
  const dismissBg = document.getElementById('gh-hud-dismiss');
  const pillStatus = document.getElementById('gh-pill-status');
  const pillBadge = document.getElementById('gh-pill-badge');
  const boardTag = document.getElementById('gh-hud-board-tag');
  const mainContent = document.getElementById('gh-hud-main-content');
  const copyAllBtn = document.getElementById('gh-copy-all-btn');

  let currentJobPayload = null;

  function showOverlay() {
    overlay.style.display = 'flex';
  }

  function hideOverlay() {
    overlay.style.display = 'none';
  }

  pill.addEventListener('click', showOverlay);
  closeBtn.addEventListener('click', hideOverlay);
  dismissBg.addEventListener('click', hideOverlay);

  // Keyboard shortcut: Ctrl+Shift+G or Alt+J
  window.addEventListener('keydown', (e) => {
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') || (e.altKey && e.key.toLowerCase() === 'j')) {
      if (overlay.style.display === 'none') showOverlay();
      else hideOverlay();
    }
  });

  // 3. AUTO-FETCH LOGIC (Executes on page load with 0 clicks)
  async function runAutoExtraction() {
    const { board, jobId } = detectJobContext();
    boardTag.textContent = \`Board: \${board} \${jobId ? '| Job ID: ' + jobId : ''}\`;

    try {
      // Step A: Check live Greenhouse JSON API if jobId is present
      if (jobId) {
        pillStatus.textContent = 'Querying API...';
        const liveApiUrl = \`https://boards-api.greenhouse.io/v1/boards/\${board}/jobs/\${jobId}\`;
        const liveResp = await fetch(liveApiUrl).catch(() => null);

        if (liveResp && liveResp.ok) {
          const liveData = await liveResp.json();
          renderSuccessJob(liveData, 'Active Greenhouse API', board, jobId);
          return;
        }
      }

      // Step B: Check company board feed for matching or active jobs
      pillStatus.textContent = 'Checking Board Feed...';
      const feedResp = await fetch(\`https://boards-api.greenhouse.io/v1/boards/\${board}/jobs?content=true\`).catch(() => null);
      if (feedResp && feedResp.ok) {
        const feedData = await feedResp.json();
        if (feedData.jobs && feedData.jobs.length > 0) {
          if (jobId) {
            const match = feedData.jobs.find(j => String(j.id) === String(jobId));
            if (match) {
              renderSuccessJob(match, 'Greenhouse Board Feed', board, jobId);
              return;
            }
          }
        }
      }

      // Step C: If live API returns 404 (e.g. Synack 8023991), automatically query Wayback Machine
      if (jobId) {
        pillStatus.textContent = 'Checking Wayback Machine...';
        const cdxUrl = \`https://web.archive.org/cdx/search/cdx?url=job-boards.greenhouse.io/\${board}/jobs/\${jobId}&output=json&limit=3\`;
        const cdxResp = await fetch(cdxUrl).catch(() => null);

        if (cdxResp && cdxResp.ok) {
          const cdxRows = await cdxResp.json();
          if (Array.isArray(cdxRows) && cdxRows.length > 1) {
            const latest = cdxRows[cdxRows.length - 1];
            const timestamp = latest[0];
            const original = latest[1];
            const archiveUrl = \`https://web.archive.org/web/\${timestamp}if_/\${original}\`;

            const snapResp = await fetch(archiveUrl).catch(() => null);
            if (snapResp && snapResp.ok) {
              const htmlRaw = await snapResp.text();
              renderArchivedJob(htmlRaw, timestamp, archiveUrl, board, jobId);
              return;
            }
          }
        }
      }

      // If completely not found
      renderNotFound(board, jobId);
    } catch (err) {
      renderError(err.message);
    }
  }

  // 4. LINK EXTRACTION & HTML PARSING UTILITIES
  function extractEmbeddedLinks(rawHtml, plainText) {
    const links = [];
    const seen = new Set();

    // Match HTML <a> tags
    const aRegex = /<a\s+(?:[^>]*?\s+)?href=["'](.*?)["'][^>]*?>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = aRegex.exec(rawHtml || '')) !== null) {
      const url = m[1].trim();
      const text = m[2].replace(/<[^>]+>/g, '').trim() || url;
      if (url && !url.startsWith('#') && !url.startsWith('javascript:') && !seen.has(url)) {
        seen.add(url);
        links.push({ url, text, type: categorizeUrl(url) });
      }
    }

    // Match mailto & naked URLs in text
    const textMatches = (plainText || '').match(/https?:\/\/[^\s<>"'{}\[\]]+/g) || [];
    for (const tu of textMatches) {
      const clean = tu.replace(/[.,;:)\]]+$/, '');
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        links.push({ url: clean, text: clean, type: categorizeUrl(clean) });
      }
    }

    const emails = (plainText || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const em of emails) {
      const mailto = 'mailto:' + em;
      if (!seen.has(mailto)) {
        seen.add(mailto);
        links.push({ url: mailto, text: em, type: 'email' });
      }
    }

    return links;
  }

  function categorizeUrl(url) {
    const u = url.toLowerCase();
    if (u.startsWith('mailto:')) return 'email';
    if (u.includes('forms.gle') || u.includes('typeform') || u.includes('docs.google.com/forms')) return 'form';
    if (u.includes('calendly.com') || u.includes('chili_piper')) return 'meeting';
    if (u.includes('drive.google.com') || u.endsWith('.pdf') || u.endsWith('.docx')) return 'doc';
    if (u.includes('apply') || u.includes('submit')) return 'apply';
    return 'external';
  }

  function renderSuccessJob(job, sourceName, board, jobId) {
    const rawContent = job.content || '';
    const tempEl = document.createElement('div');
    tempEl.innerHTML = rawContent;
    const plainText = tempEl.textContent || tempEl.innerText || '';
    const links = extractEmbeddedLinks(rawContent, plainText);

    currentJobPayload = {
      title: job.title,
      location: job.location?.name || 'Remote / Unspecified',
      source: sourceName,
      links: links,
      plainText: plainText
    };

    pillStatus.textContent = job.title.slice(0, 22) + '...';
    pillBadge.style.display = 'inline-block';
    pillBadge.textContent = \`\${links.length} links\`;

    mainContent.innerHTML = \`
      <div class="gh-banner success">
        <span class="gh-status-badge success">✓ \${sourceName}</span>
        <span class="gh-banner-text">Recovered job description & embedded links automatically</span>
      </div>

      <div class="gh-job-header">
        <h2 class="gh-job-title">\${job.title}</h2>
        <div class="gh-job-meta">
          <span>📍 \${job.location?.name || 'Remote / Unspecified'}</span>
          <span>•</span>
          <span>ID: \${job.id}</span>
        </div>
      </div>

      <!-- Links Section -->
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Extracted Links & Actions (\${links.length})</h4>
          <span class="gh-badge-sub">Click to copy/open</span>
        </div>
        <div class="gh-links-grid">
          \${links.length > 0 ? links.map((l, i) => \`
            <div class="gh-link-row">
              <span class="gh-tag \${l.type}">\${l.type}</span>
              <a href="\${l.url}" target="_blank" class="gh-link-text">\${l.text}</a>
              <button class="gh-btn-mini" onclick="navigator.clipboard.writeText('\${l.url}')" title="Copy URL">Copy</button>
            </div>
          \`).join('') : '<p class="gh-empty">No embedded URLs or links found in job description.</p>'}
        </div>
      </div>

      <!-- Description Section -->
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Job Description</h4>
          <button class="gh-btn-mini" id="gh-copy-desc-btn">Copy Text</button>
        </div>
        <div class="gh-desc-box">\${rawContent}</div>
      </div>
    \`;

    document.getElementById('gh-copy-desc-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(plainText);
      alert('Job description copied to clipboard!');
    });

    // Auto-pop HUD so user sees it right away without lifting a finger!
    showOverlay();
  }

  function renderArchivedJob(htmlRaw, timestamp, archiveUrl, board, jobId) {
    const titleMatch = htmlRaw.match(/<h1[^>]*app-title[^>]*>([\\s\\S]*?)<\\/h1>/i) || htmlRaw.match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : \`Archived Job #\${jobId}\`;

    const cleanHtml = htmlRaw.replace(/<script[\\s\\S]*?<\\/script>/gi, '').replace(/<style[\\s\\S]*?<\\/style>/gi, '');
    const temp = document.createElement('div');
    temp.innerHTML = cleanHtml;
    const plainText = temp.textContent || temp.innerText || '';
    const links = extractEmbeddedLinks(cleanHtml, plainText);

    currentJobPayload = {
      title: title,
      location: 'Preserved Snapshot',
      source: 'Wayback Machine Archive (' + timestamp + ')',
      links: links,
      plainText: plainText
    };

    pillStatus.textContent = title.slice(0, 20) + '...';
    pillBadge.style.display = 'inline-block';
    pillBadge.textContent = \`\${links.length} links (Archived)\`;

    mainContent.innerHTML = \`
      <div class="gh-banner warning">
        <span class="gh-status-badge warning">⚠ Expired Job Restored</span>
        <span class="gh-banner-text">Post unlisted on live Greenhouse. Restored via Wayback Archive (\${timestamp}).</span>
      </div>

      <div class="gh-job-header">
        <h2 class="gh-job-title">\${title}</h2>
        <div class="gh-job-meta">
          <span>📅 Snapshot: \${timestamp}</span>
          <span>•</span>
          <a href="\${archiveUrl}" target="_blank" class="gh-archive-link">Open Original Snapshot ↗</a>
        </div>
      </div>

      <!-- Links Section -->
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Extracted Embedded Links (\${links.length})</h4>
        </div>
        <div class="gh-links-grid">
          \${links.length > 0 ? links.map((l) => \`
            <div class="gh-link-row">
              <span class="gh-tag \${l.type}">\${l.type}</span>
              <a href="\${l.url}" target="_blank" class="gh-link-text">\${l.text}</a>
              <button class="gh-btn-mini" onclick="navigator.clipboard.writeText('\${l.url}')">Copy</button>
            </div>
          \`).join('') : '<p class="gh-empty">No embedded links found.</p>'}
        </div>
      </div>

      <!-- Description Section -->
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Archived Job Description</h4>
          <button class="gh-btn-mini" id="gh-copy-desc-btn">Copy Text</button>
        </div>
        <div class="gh-desc-box">\${plainText.slice(0, 2500)}...</div>
      </div>
    \`;

    document.getElementById('gh-copy-desc-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(plainText);
      alert('Archived description copied to clipboard!');
    });

    // Auto-pop HUD so user sees it right away
    showOverlay();
  }

  function renderNotFound(board, jobId) {
    pillStatus.textContent = 'GH Job Inactive';
    mainContent.innerHTML = \`
      <div class="gh-banner danger">
        <span class="gh-status-badge danger">✕ Inactive / Expired</span>
        <span class="gh-banner-text">Job \${jobId || ''} was unlisted from board "\${board}".</span>
      </div>
      <div style="margin-top: 16px;">
        <p style="color: #64748b; font-size: 13px;">Greenhouse redirects deleted jobs to the company homepage. You can view all live active positions for <b>\${board}</b> directly:</p>
        <a href="https://boards-api.greenhouse.io/v1/boards/\${board}/jobs?content=true" target="_blank" class="gh-action-btn">
          View Active \${board} Jobs API Feed ↗
        </a>
      </div>
    \`;
  }

  function renderError(msg) {
    pillStatus.textContent = 'GH Extraction Failed';
    mainContent.innerHTML = \`
      <div class="gh-banner danger">
        <span class="gh-status-badge danger">Error</span>
        <span class="gh-banner-text">\${msg}</span>
      </div>
    \`;
  }

  // Copy All Handler
  copyAllBtn?.addEventListener('click', () => {
    if (!currentJobPayload) return;
    const summary = \`JOB: \${currentJobPayload.title}\\nSOURCE: \${currentJobPayload.source}\\n\\nEXTRACTED LINKS (\\n\${currentJobPayload.links.map(l => \`[\${l.type}] \${l.text}: \${l.url}\`).join('\\n')}\\n)\\n\\nDESCRIPTION:\\n\${currentJobPayload.plainText}\`;
    navigator.clipboard.writeText(summary);
    alert('Full job summary and all links copied!');
  });

  // Run automatically on load
  runAutoExtraction();
})();
`,

  stylesCss: `/* styles.css - Clean Minimalist Floating HUD (Zero Sidebar Conflicts) */
#gh-auto-extractor-root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #0f172a;
}

/* Floating Pill at bottom right */
#gh-pill-trigger {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483640;
  cursor: pointer;
  user-select: none;
}

.gh-pill-body {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  color: #1e293b;
  padding: 8px 14px;
  border-radius: 9999px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.gh-pill-body:hover {
  transform: translateY(-2px);
  border-color: #2563eb;
  box-shadow: 0 14px 30px -5px rgba(37, 99, 235, 0.2);
}

.gh-pill-icon {
  color: #2563eb;
  font-size: 14px;
}

.gh-pill-count {
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 9999px;
  font-weight: 700;
}

/* Center HUD Overlay */
#gh-hud-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.gh-hud-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
}

.gh-hud-card {
  position: relative;
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ghFadeIn 0.15s ease-out;
}

@keyframes ghFadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.gh-hud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
}

.gh-hud-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.gh-hud-icon-box {
  width: 32px;
  height: 32px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.gh-hud-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.gh-hud-subtitle {
  margin: 0;
  font-size: 11px;
  color: #64748b;
}

.gh-hud-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gh-hud-btn-copy {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.gh-hud-btn-copy:hover { background: #f1f5f9; }

.gh-hud-btn-close {
  background: transparent;
  border: none;
  font-size: 16px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.gh-hud-btn-close:hover { color: #0f172a; background: #e2e8f0; }

.gh-hud-content {
  padding: 16px 18px;
  overflow-y: auto;
  font-size: 13px;
  color: #334155;
}

/* Banner */
.gh-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  margin-bottom: 14px;
}

.gh-banner.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.gh-banner.warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.gh-banner.danger { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

.gh-status-badge {
  font-weight: 700;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.gh-status-badge.success { background: #dcfce7; color: #15803d; }
.gh-status-badge.warning { background: #fef3c7; color: #b45309; }
.gh-status-badge.danger { background: #fee2e2; color: #b91c1c; }

.gh-job-header { margin-bottom: 14px; }
.gh-job-title { font-size: 17px; font-weight: 700; margin: 0 0 4px 0; color: #0f172a; }
.gh-job-meta { font-size: 12px; color: #64748b; display: flex; gap: 8px; align-items: center; }

.gh-archive-link { color: #2563eb; text-decoration: none; font-weight: 600; }
.gh-archive-link:hover { text-decoration: underline; }

.gh-section { margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
.gh-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.gh-section-header h4 { margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; }
.gh-badge-sub { font-size: 11px; color: #94a3b8; }

.gh-links-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
}

.gh-link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
}

.gh-tag {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
}

.gh-tag.apply { background: #eff6ff; color: #1d4ed8; }
.gh-tag.email { background: #fdf2f8; color: #be185d; }
.gh-tag.form { background: #f5f3ff; color: #6d28d9; }
.gh-tag.meeting { background: #ecfdf5; color: #047857; }

.gh-link-text {
  flex: 1;
  color: #2563eb;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.gh-link-text:hover { text-decoration: underline; }

.gh-btn-mini {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.gh-btn-mini:hover { background: #e2e8f0; }

.gh-desc-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  max-height: 180px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.6;
  color: #334155;
}

.gh-action-btn {
  display: inline-block;
  background: #2563eb;
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
  margin-top: 8px;
}

.gh-empty { color: #94a3b8; font-size: 12px; margin: 6px 0; text-align: center; }

.gh-loader-box {
  padding: 30px;
  text-align: center;
  color: #64748b;
  font-size: 12px;
}

.gh-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: ghSpin 0.7s linear infinite;
  margin: 0 auto 10px auto;
}

@keyframes ghSpin { to { transform: rotate(360deg); } }
`,

  popupHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      width: 320px;
      margin: 0;
      padding: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ffffff;
      color: #0f172a;
    }
    h2 { font-size: 14px; margin: 0 0 8px 0; color: #0f172a; font-weight: 700; }
    p { font-size: 12px; color: #64748b; margin: 0 0 12px 0; line-height: 1.4; }
    .status-pill { background: #eff6ff; color: #1d4ed8; padding: 6px 10px; border-radius: 6px; font-size: 11px; margin-bottom: 10px; font-weight: 600; }
    button {
      width: 100%;
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <h2>⚡ Greenhouse Auto-Extractor</h2>
  <p>The extension runs automatically whenever you open any Greenhouse job page. It displays in-page with <b>zero sidebar conflicts</b>.</p>
  <div class="status-pill">✓ Automatic URL & Link Extraction Active</div>
  <button id="openHudBtn">Trigger In-Page HUD</button>
  <script src="popup.js"></script>
</body>
</html>
`,

  popupJs: `// popup.js - Quick trigger
document.getElementById('openHudBtn')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const overlay = document.getElementById('gh-hud-overlay');
        if (overlay) overlay.style.display = 'flex';
      }
    });
  }
  window.close();
});
`
};
