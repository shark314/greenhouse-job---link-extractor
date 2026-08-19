// content.js — auto-detect Greenhouse board/job, fetch description, show left floating panel
(function () {
  if (window.__gh_extractor_initialized) return;
  window.__gh_extractor_initialized = true;

  const RESERVED_PATHS = new Set([
    "",
    "jobs",
    "embed",
    "embeddable",
    "v1",
    "boards",
    "job-boards",
    "users",
    "login",
    "oauth",
  ]);

  let currentJobPayload = null;
  let panelOpen = false;
  let lastContext = { board: null, jobId: null, url: location.href };
  let lastSource = "";
  let lastTitle = "";
  let lastLinkCount = 0;

  function isReservedBoard(value) {
    return !value || RESERVED_PATHS.has(String(value).toLowerCase());
  }

  function parseGreenhouseUrl(raw) {
    if (!raw) return { board: null, jobId: null };
    try {
      const parsed = new URL(raw);
      if (!parsed.hostname.toLowerCase().endsWith("greenhouse.io")) {
        return { board: null, jobId: null };
      }

      const path = parsed.pathname.replace(/\/+$/, "") || "/";
      const params = parsed.searchParams;

      let board = params.get("for") || params.get("board");
      let jobId = params.get("gh_jid") || params.get("token") || params.get("job_id");

      const jobPath = path.match(/(?:\/v1\/boards)?\/([^/]+)\/jobs\/(\d+)/i);
      if (jobPath && !isReservedBoard(jobPath[1])) {
        board = board || jobPath[1];
        jobId = jobId || jobPath[2];
      } else {
        const boardOnly = path.match(/^\/([^/]+)\/?$/);
        if (boardOnly && !isReservedBoard(boardOnly[1])) {
          board = board || boardOnly[1];
        }
      }

      return { board: board || null, jobId: jobId || null };
    } catch {
      return { board: null, jobId: null };
    }
  }

  function detectJobContext() {
    const fromUrl = parseGreenhouseUrl(window.location.href);
    const fromRef = parseGreenhouseUrl(document.referrer);
    return {
      board: fromUrl.board || fromRef.board || null,
      jobId: fromUrl.jobId || fromRef.jobId || null,
      url: window.location.href,
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function decodeHtmlEntities(str) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = str || "";
    return textarea.value;
  }

  function looksEncodedHtml(str) {
    return /&lt;\/?[a-z][\s\S]*?&gt;/i.test(str || "");
  }

  function decodeJobHtml(raw) {
    if (!raw) return "";
    return looksEncodedHtml(raw) ? decodeHtmlEntities(raw) : raw;
  }

  function htmlToPlainText(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";
    return (temp.textContent || temp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function categorizeUrl(url) {
    const u = String(url || "").toLowerCase();
    if (u.startsWith("mailto:")) return "email";
    if (u.includes("forms.gle") || u.includes("typeform") || u.includes("docs.google.com/forms")) return "form";
    if (u.includes("calendly.com") || u.includes("chili_piper") || u.includes("chilipiper")) return "meeting";
    if (u.includes("drive.google.com") || u.includes(".pdf") || u.includes(".docx")) return "document";
    if (u.includes("linkedin.com") || u.includes("github.com") || u.includes("twitter.com") || u.includes("x.com")) {
      return "social";
    }
    if (u.includes("apply") || u.includes("submit") || /\/jobs\/\d+/.test(u)) return "apply";
    return "external";
  }

  function extractEmbeddedLinks(rawHtml, plainText) {
    const links = [];
    const seen = new Set();

    const aRegex = /<a\s+(?:[^>]*?\s+)?href=["'](.*?)["'][^>]*?>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = aRegex.exec(rawHtml || "")) !== null) {
      const url = decodeHtmlEntities(match[1]).trim();
      const text = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, "")).trim() || url;
      if (url && !url.startsWith("#") && !url.toLowerCase().startsWith("javascript:") && !seen.has(url)) {
        seen.add(url);
        links.push({ url, text, type: categorizeUrl(url) });
      }
    }

    const textMatches = (plainText || "").match(/https?:\/\/[^\s<>"'{}\[\]]+/g) || [];
    for (const raw of textMatches) {
      const clean = raw.replace(/[.,;:)\]>]+$/, "");
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        links.push({ url: clean, text: clean, type: categorizeUrl(clean) });
      }
    }

    const emails = (plainText || "").match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const email of emails) {
      const mailto = "mailto:" + email;
      if (!seen.has(mailto)) {
        seen.add(mailto);
        links.push({ url: mailto, text: email, type: "email" });
      }
    }

    return links;
  }

  function renderLinkRows(links) {
    if (!links.length) {
      return '<p class="gh-empty">No embedded URLs, links, or emails found in the job description.</p>';
    }
    return links
      .map(
        (link) => `
        <div class="gh-link-row">
          <span class="gh-tag ${escapeHtml(link.type)}">${escapeHtml(link.type)}</span>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="gh-link-text">${escapeHtml(link.text)}</a>
          <button type="button" class="gh-btn-mini" data-copy-url="${escapeHtml(link.url)}">Copy</button>
        </div>`
      )
      .join("");
  }

  const uiContainer = document.createElement("div");
  uiContainer.id = "gh-auto-extractor-root";
  uiContainer.innerHTML = `
    <div id="gh-pill-trigger" title="Collapse or reopen Greenhouse job panel">
      <div class="gh-pill-body">
        <span class="gh-pill-icon">⚡</span>
        <span class="gh-pill-label" id="gh-pill-status">Extracting job…</span>
        <span class="gh-pill-count" id="gh-pill-badge" style="display:none;">0 links</span>
      </div>
    </div>
    <div id="gh-hud-overlay">
      <div class="gh-hud-card">
        <div class="gh-hud-header">
          <div class="gh-hud-title-group">
            <div class="gh-hud-icon-box">⚡</div>
            <div>
              <h3 class="gh-hud-title">Greenhouse Job Overlay</h3>
              <p class="gh-hud-subtitle" id="gh-hud-board-tag">Detecting board and job from URL…</p>
            </div>
          </div>
          <div class="gh-hud-actions">
            <button type="button" class="gh-hud-btn-copy" id="gh-copy-all-btn" title="Copy job description and links">Copy all</button>
            <button type="button" class="gh-hud-btn-close" id="gh-close-hud" title="Collapse panel">✕</button>
          </div>
        </div>
        <div class="gh-hud-content" id="gh-hud-main-content">
          <div class="gh-loader-box">
            <div class="gh-spinner"></div>
            <p>Querying Greenhouse API, board feed, then Wayback if needed…</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const host = document.createElement("div");
  host.id = "gh-auto-extractor-host";
  host.setAttribute("data-gh-overlay", "1");
  host.style.cssText =
    "all:initial;position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" });
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("styles.css");
  shadow.appendChild(styleLink);
  shadow.appendChild(uiContainer);

  function mountHost() {
    if (!document.documentElement.contains(host)) {
      document.documentElement.appendChild(host);
      return true;
    }
    return false;
  }
  mountHost();

  new MutationObserver(() => {
    mountHost();
  }).observe(document.documentElement, { childList: true, subtree: true });

  const pill = shadow.getElementById("gh-pill-trigger");
  const overlay = shadow.getElementById("gh-hud-overlay");
  const closeBtn = shadow.getElementById("gh-close-hud");
  const pillStatus = shadow.getElementById("gh-pill-status");
  const pillBadge = shadow.getElementById("gh-pill-badge");
  const boardTag = shadow.getElementById("gh-hud-board-tag");
  const mainContent = shadow.getElementById("gh-hud-main-content");
  const copyAllBtn = shadow.getElementById("gh-copy-all-btn");

  function showPanel() {
    overlay.classList.add("is-open");
    overlay.style.display = "block";
    panelOpen = true;
    mountHost();
  }

  function hidePanel() {
    overlay.classList.remove("is-open");
    overlay.style.display = "none";
    panelOpen = false;
  }

  function togglePanel() {
    if (panelOpen) hidePanel();
    else showPanel();
  }

  function getStatus() {
    return {
      board: lastContext.board,
      jobId: lastContext.jobId,
      title: lastTitle,
      source: lastSource,
      linkCount: lastLinkCount,
      panelOpen,
    };
  }

  pill.addEventListener("click", togglePanel);
  closeBtn.addEventListener("click", hidePanel);

  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "g") {
      event.preventDefault();
      togglePanel();
    }
  });

  mainContent.addEventListener("click", async (event) => {
    const copyBtn = event.target.closest("[data-copy-url]");
    if (copyBtn) {
      await navigator.clipboard.writeText(copyBtn.getAttribute("data-copy-url") || "");
      copyBtn.textContent = "Copied";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
      return;
    }
    const descBtn = event.target.closest("#gh-copy-desc-btn");
    if (descBtn && currentJobPayload) {
      await navigator.clipboard.writeText(currentJobPayload.plainText || "");
      descBtn.textContent = "Copied";
      setTimeout(() => {
        descBtn.textContent = "Copy text";
      }, 1200);
    }
  });

  copyAllBtn.addEventListener("click", async () => {
    if (!currentJobPayload) return;
    const summary = [
      `JOB: ${currentJobPayload.title}`,
      `SOURCE: ${currentJobPayload.source}`,
      `LOCATION: ${currentJobPayload.location || ""}`,
      "",
      "EXTRACTED LINKS:",
      currentJobPayload.links.map((link) => `[${link.type}] ${link.text}: ${link.url}`).join("\n") || "(none)",
      "",
      "DESCRIPTION:",
      currentJobPayload.plainText || "",
    ].join("\n");
    await navigator.clipboard.writeText(summary);
    copyAllBtn.textContent = "Copied";
    setTimeout(() => {
      copyAllBtn.textContent = "Copy all";
    }, 1200);
  });

  function locationName(job) {
    if (!job) return "Unspecified";
    if (typeof job.location === "string") return job.location;
    return job.location?.name || "Remote / Unspecified";
  }

  function renderSuccessJob(job, sourceName, board, jobId) {
    const rawContent = decodeJobHtml(job.content || "");
    const plainText = htmlToPlainText(rawContent);
    const links = extractEmbeddedLinks(rawContent, plainText);
    const title = job.title || `Job #${jobId || job.id || ""}`;
    const loc = locationName(job);

    currentJobPayload = { title, location: loc, source: sourceName, links, plainText };
    lastSource = sourceName;
    lastTitle = title;
    lastLinkCount = links.length;

    pillStatus.textContent = title.length > 22 ? title.slice(0, 22) + "…" : title;
    pillBadge.style.display = "inline-block";
    pillBadge.textContent = `${links.length} links`;

    mainContent.innerHTML = `
      <div class="gh-banner success">
        <span class="gh-status-badge success">${escapeHtml(sourceName)}</span>
        <span class="gh-banner-text">Recovered job description and embedded links</span>
      </div>
      <div class="gh-job-header">
        <h2 class="gh-job-title">${escapeHtml(title)}</h2>
        <div class="gh-job-meta">
          <span>${escapeHtml(loc)}</span>
          <span>•</span>
          <span>ID: ${escapeHtml(job.id || jobId || "")}</span>
        </div>
      </div>
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Extracted links (${links.length})</h4>
          <span class="gh-badge-sub">Open or copy</span>
        </div>
        <div class="gh-links-grid">${renderLinkRows(links)}</div>
      </div>
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Job description</h4>
          <button type="button" class="gh-btn-mini" id="gh-copy-desc-btn">Copy text</button>
        </div>
        <div class="gh-desc-box">${rawContent}</div>
      </div>
    `;

    showPanel();
  }

  function extractArchivedParts(htmlRaw, jobId) {
    const doc = new DOMParser().parseFromString(htmlRaw, "text/html");
    const titleEl = doc.querySelector("h1.app-title, h1");
    const title = (titleEl?.textContent || "").replace(/\s+/g, " ").trim() || `Archived job #${jobId}`;
    const locEl = doc.querySelector(".location, .job__location, [class*='location']");
    const location = (locEl?.textContent || "").replace(/\s+/g, " ").trim() || "See description";
    const descEl = doc.querySelector(
      ".job__description, #content, .content, [class*='job-description'], .job-post, #job_description"
    );
    let descriptionHtml = descEl ? descEl.innerHTML : "";
    if (!descriptionHtml) {
      const stripped = htmlRaw
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "");
      descriptionHtml = `<p>${escapeHtml(htmlToPlainText(stripped).slice(0, 4000))}</p>`;
    }
    return { title, location, descriptionHtml };
  }

  function renderArchivedJob(htmlRaw, timestamp, archiveUrl, board, jobId) {
    const parts = extractArchivedParts(htmlRaw, jobId);
    const plainText = htmlToPlainText(parts.descriptionHtml);
    const links = extractEmbeddedLinks(parts.descriptionHtml, plainText);
    const sourceName = `Wayback (${timestamp})`;

    currentJobPayload = {
      title: parts.title,
      location: parts.location,
      source: sourceName,
      links,
      plainText,
    };
    lastSource = sourceName;
    lastTitle = parts.title;
    lastLinkCount = links.length;

    pillStatus.textContent = parts.title.length > 20 ? parts.title.slice(0, 20) + "…" : parts.title;
    pillBadge.style.display = "inline-block";
    pillBadge.textContent = `${links.length} links`;

    mainContent.innerHTML = `
      <div class="gh-banner warning">
        <span class="gh-status-badge warning">Wayback archive</span>
        <span class="gh-banner-text">Live Greenhouse missed this posting. Restored snapshot ${escapeHtml(timestamp)}.</span>
      </div>
      <div class="gh-job-header">
        <h2 class="gh-job-title">${escapeHtml(parts.title)}</h2>
        <div class="gh-job-meta">
          <span>${escapeHtml(parts.location)}</span>
          <span>•</span>
          <a href="${escapeHtml(archiveUrl)}" target="_blank" rel="noopener noreferrer" class="gh-archive-link">Open snapshot ↗</a>
        </div>
      </div>
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Extracted links (${links.length})</h4>
          <span class="gh-badge-sub">Open or copy</span>
        </div>
        <div class="gh-links-grid">${renderLinkRows(links)}</div>
      </div>
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Job description</h4>
          <button type="button" class="gh-btn-mini" id="gh-copy-desc-btn">Copy text</button>
        </div>
        <div class="gh-desc-box">${parts.descriptionHtml}</div>
      </div>
    `;

    showPanel();
  }

  function renderLiveBoardList(jobs, board) {
    if (!jobs?.length) return "";
    const rows = jobs
      .slice(0, 12)
      .map((job) => {
        const href = job.absolute_url || `https://job-boards.greenhouse.io/${encodeURIComponent(board)}/jobs/${job.id}`;
        return `
          <a class="gh-live-job" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
            <strong>${escapeHtml(job.title || `Job ${job.id}`)}</strong>
            <span>${escapeHtml(locationName(job))} · ${escapeHtml(job.id)}</span>
          </a>`;
      })
      .join("");
    return `
      <div class="gh-section">
        <div class="gh-section-header">
          <h4>Live board jobs (${jobs.length})</h4>
        </div>
        <div class="gh-live-jobs">${rows}</div>
      </div>`;
  }

  function renderNotFound(board, jobId, liveJobs) {
    lastSource = "Expired / unpublished";
    lastTitle = jobId ? `Job ${jobId}` : "No job id";
    lastLinkCount = 0;
    currentJobPayload = {
      title: lastTitle,
      location: "",
      source: lastSource,
      links: [],
      plainText: "",
    };

    pillStatus.textContent = "Job inactive";
    pillBadge.style.display = "none";

    mainContent.innerHTML = `
      <div class="gh-banner danger">
        <span class="gh-status-badge danger">Expired / unpublished</span>
        <span class="gh-banner-text">${
          jobId
            ? `Job ${escapeHtml(jobId)} was not on the live API, board feed, or Wayback.`
            : "No job id was found on this page or its referrer."
        }</span>
      </div>
      <p style="color:#64748b;font-size:13px;margin:0;">
        Greenhouse often redirects unpublished jobs to the company board.
        ${board ? `Live openings for <b>${escapeHtml(board)}</b> are listed below when the feed is available.` : ""}
      </p>
      ${
        board
          ? `<a href="https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true" target="_blank" rel="noopener noreferrer" class="gh-action-btn">Open ${escapeHtml(board)} jobs API ↗</a>`
          : ""
      }
      ${renderLiveBoardList(liveJobs, board)}
    `;

    showPanel();
  }

  function renderNeedBoard() {
    lastSource = "";
    lastTitle = "";
    lastLinkCount = 0;
    pillStatus.textContent = "No board detected";
    pillBadge.style.display = "none";
    mainContent.innerHTML = `
      <div class="gh-banner danger">
        <span class="gh-status-badge danger">No board</span>
        <span class="gh-banner-text">Could not parse a Greenhouse board token from this URL or the document referrer. Nothing is hard-coded.</span>
      </div>
    `;
    showPanel();
  }

  function renderError(message) {
    lastSource = "Error";
    pillStatus.textContent = "Extraction failed";
    mainContent.innerHTML = `
      <div class="gh-banner danger">
        <span class="gh-status-badge danger">Error</span>
        <span class="gh-banner-text">${escapeHtml(message)}</span>
      </div>
    `;
    showPanel();
  }

  async function fetchJson(url) {
    const response = await fetch(url).catch(() => null);
    if (!response || !response.ok) return null;
    return response.json().catch(() => null);
  }

  async function fetchText(url) {
    const response = await fetch(url).catch(() => null);
    if (!response || !response.ok) return null;
    return response.text().catch(() => null);
  }

  async function fetchWayback(board, jobId) {
    const targets = [
      `https://job-boards.greenhouse.io/${board}/jobs/${jobId}`,
      `https://boards.greenhouse.io/${board}/jobs/${jobId}`,
    ];

    for (const targetUrl of targets) {
      const cdxUrl =
        "https://web.archive.org/cdx/search/cdx?url=" +
        encodeURIComponent(targetUrl) +
        "&output=json&limit=5&fl=timestamp,original";
      const rows = await fetchJson(cdxUrl);
      if (!Array.isArray(rows) || rows.length < 2) continue;

      const latest = rows[rows.length - 1];
      const timestamp = latest[0];
      const original = latest[1] || targetUrl;
      const archiveUrl = `https://web.archive.org/web/${timestamp}if_/${original}`;
      const htmlRaw = await fetchText(archiveUrl);
      if (htmlRaw) {
        return { htmlRaw, timestamp, archiveUrl };
      }
    }
    return null;
  }

  async function runAutoExtraction() {
    const ctx = detectJobContext();
    lastContext = ctx;
    const { board, jobId } = ctx;

    boardTag.textContent = board
      ? `Board: ${board}${jobId ? " · Job ID: " + jobId : " · no job id"}`
      : "No Greenhouse board detected";

    if (!board) {
      renderNeedBoard();
      return;
    }

    try {
      if (jobId) {
        pillStatus.textContent = "Querying API…";
        const liveData = await fetchJson(
          `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(jobId)}`
        );
        if (liveData && (liveData.title || liveData.content || liveData.id)) {
          renderSuccessJob(liveData, "Live job API", board, jobId);
          return;
        }
      }

      pillStatus.textContent = "Checking board feed…";
      const feedData = await fetchJson(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`
      );
      const liveJobs = Array.isArray(feedData?.jobs) ? feedData.jobs : [];
      if (jobId) {
        const match = liveJobs.find((job) => String(job.id) === String(jobId));
        if (match) {
          renderSuccessJob(match, "Board feed", board, jobId);
          return;
        }
      }

      if (jobId) {
        pillStatus.textContent = "Checking Wayback…";
        const archived = await fetchWayback(board, jobId);
        if (archived) {
          renderArchivedJob(archived.htmlRaw, archived.timestamp, archived.archiveUrl, board, jobId);
          return;
        }
      }

      renderNotFound(board, jobId, liveJobs);
    } catch (err) {
      renderError(err && err.message ? err.message : String(err));
    }
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "GH_GET_STATUS") {
        sendResponse(getStatus());
        return;
      }
      if (message?.type === "GH_TOGGLE_PANEL") {
        togglePanel();
        sendResponse(getStatus());
      }
    });
  }

  runAutoExtraction();
})();
