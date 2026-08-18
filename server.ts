import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy/Safe Gemini instance
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Helper to decode HTML entities
function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Helper to extract links from HTML & text
interface ExtractedLink {
  url: string;
  text: string;
  type: "apply" | "email" | "form" | "document" | "external" | "meeting" | "social";
  context?: string;
}

function extractLinksFromContent(htmlContent: string, plainText: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seenUrls = new Set<string>();

  // 1. Match <a> tags in HTML
  const aTagRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*?>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = aTagRegex.exec(htmlContent)) !== null) {
    let url = match[2]?.trim();
    let text = match[3]?.replace(/<[^>]+>/g, "").trim() || url;
    
    if (url && !url.startsWith("javascript:") && !url.startsWith("#")) {
      url = decodeHtmlEntities(url);
      text = decodeHtmlEntities(text);
      
      let type: ExtractedLink["type"] = "external";
      const lower = url.toLowerCase();
      if (lower.startsWith("mailto:")) type = "email";
      else if (lower.includes("apply") || lower.includes("application") || lower.includes("jobs/")) type = "apply";
      else if (lower.includes("forms.gle") || lower.includes("docs.google.com/forms") || lower.includes("typeform") || lower.includes("airtable")) type = "form";
      else if (lower.includes("calendly.com") || lower.includes("chili_piper") || lower.includes("hubspot.com/meetings")) type = "meeting";
      else if (lower.includes("drive.google.com") || lower.includes("dropbox.com") || lower.includes(".pdf") || lower.includes(".docx")) type = "document";
      else if (lower.includes("linkedin.com") || lower.includes("twitter.com") || lower.includes("x.com") || lower.includes("github.com")) type = "social";

      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        links.push({ url, text, type });
      }
    }
  }

  // 2. Match raw text URLs (e.g. https://... or http://...)
  const rawUrlRegex = /(https?:\/\/[^\s<>"'{}|\\^`[\]]+)/gi;
  let rawMatch: RegExpExecArray | null;
  while ((rawMatch = rawUrlRegex.exec(plainText)) !== null) {
    let rawUrl = rawMatch[1]?.trim();
    // Clean trailing punctuation
    rawUrl = rawUrl.replace(/[.,;:)\]]+$/, "");
    if (rawUrl && !seenUrls.has(rawUrl)) {
      seenUrls.add(rawUrl);
      let type: ExtractedLink["type"] = "external";
      const lower = rawUrl.toLowerCase();
      if (lower.includes("apply") || lower.includes("application") || lower.includes("jobs/")) type = "apply";
      else if (lower.includes("forms.gle") || lower.includes("docs.google.com/forms") || lower.includes("typeform") || lower.includes("airtable")) type = "form";
      else if (lower.includes("calendly.com") || lower.includes("meeting")) type = "meeting";
      else if (lower.includes("drive.google.com") || lower.includes(".pdf")) type = "document";
      else if (lower.includes("linkedin.com") || lower.includes("github.com")) type = "social";

      links.push({ url: rawUrl, text: rawUrl, type });
    }
  }

  // 3. Match raw email addresses
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  let emailMatch: RegExpExecArray | null;
  while ((emailMatch = emailRegex.exec(plainText)) !== null) {
    const email = emailMatch[1].trim();
    const mailto = `mailto:${email}`;
    if (!seenUrls.has(mailto)) {
      seenUrls.add(mailto);
      links.push({ url: mailto, text: email, type: "email" });
    }
  }

  return links;
}

// Parse input into board and jobId
function parseGreenhouseInput(input: string): { boardToken: string; jobId: string | null } {
  let trimmed = input.trim();
  
  // Format 1: boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}
  let m = trimmed.match(/boards-api\.greenhouse\.io\/v1\/boards\/([a-zA-Z0-9_-]+)\/jobs\/(\d+)/i);
  if (m) return { boardToken: m[1], jobId: m[2] };

  // Format 2: job-boards.greenhouse.io/{board}/jobs/{id}
  m = trimmed.match(/job-boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)\/jobs\/(\d+)/i);
  if (m) return { boardToken: m[1], jobId: m[2] };

  // Format 3: boards.greenhouse.io/{board}/jobs/{id} or /embed/job_app?for={board}&token={id}
  m = trimmed.match(/boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)\/jobs\/(\d+)/i);
  if (m) return { boardToken: m[1], jobId: m[2] };

  // Format 4: ?for={board}&token={id}
  m = trimmed.match(/[?&]for=([a-zA-Z0-9_-]+).*[?&]token=(\d+)/i);
  if (m) return { boardToken: m[1], jobId: m[2] };

  // Format 5: {board}/jobs/{id} or {board}/{id} or {board} {id}
  m = trimmed.match(/^([a-zA-Z0-9_-]+)[/\s]+(\d+)$/i);
  if (m) return { boardToken: m[1], jobId: m[2] };

  // Format 6: Just board name e.g. "synack"
  m = trimmed.match(/^([a-zA-Z0-9_-]+)$/i);
  if (m) return { boardToken: m[1], jobId: null };

  return { boardToken: trimmed.replace(/[^a-zA-Z0-9_-]/g, ""), jobId: null };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Main Greenhouse Job Fetch & Archive fallback
app.post("/api/greenhouse/fetch", async (req, res) => {
  try {
    const { urlOrInput, board, jobId } = req.body;
    let targetBoard = board;
    let targetJobId = jobId;

    if (urlOrInput) {
      const parsed = parseGreenhouseInput(urlOrInput);
      if (parsed.boardToken) targetBoard = parsed.boardToken;
      if (parsed.jobId) targetJobId = parsed.jobId;
    }

    if (!targetBoard) {
      return res.status(400).json({ error: "Missing Greenhouse board token or job URL." });
    }

    const result: any = {
      board: targetBoard,
      jobId: targetJobId,
      status: "unknown",
      source: "none",
      job: null,
      links: [],
      rawHtml: "",
      plainText: "",
      archiveSnapshots: [],
      apiEndpoints: {
        jobApi: targetJobId ? `https://boards-api.greenhouse.io/v1/boards/${targetBoard}/jobs/${targetJobId}` : null,
        boardAllJobsApi: `https://boards-api.greenhouse.io/v1/boards/${targetBoard}/jobs?content=true`,
        boardDepartmentsApi: `https://boards-api.greenhouse.io/v1/boards/${targetBoard}/departments`,
      },
    };

    // Step 1: Try the direct Greenhouse JSON API if jobId is provided
    if (targetJobId) {
      const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${targetBoard}/jobs/${targetJobId}`;
      try {
        const apiResponse = await fetch(apiUrl, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (apiResponse.ok) {
          const jobData = await apiResponse.json();
          result.status = "active_api";
          result.source = "greenhouse_api";
          result.job = jobData;
          
          const rawContent = jobData.content || "";
          const decodedContent = decodeHtmlEntities(rawContent);
          result.rawHtml = decodedContent;
          result.plainText = decodedContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          result.links = extractLinksFromContent(decodedContent, result.plainText);
          
          return res.json(result);
        } else {
          result.apiStatusCode = apiResponse.status;
          result.apiStatusText = apiResponse.statusText;
        }
      } catch (err: any) {
        result.apiError = err.message;
      }
    }

    // Step 2: Try fetching all active jobs on board to see if it matches ID or is active under board
    try {
      const allJobsUrl = `https://boards-api.greenhouse.io/v1/boards/${targetBoard}/jobs?content=true`;
      const allJobsResp = await fetch(allJobsUrl, {
        headers: { "Accept": "application/json" },
      });

      if (allJobsResp.ok) {
        const allJobsData = await allJobsResp.json();
        const jobsList = allJobsData.jobs || [];
        result.totalActiveBoardJobs = jobsList.length;

        if (targetJobId) {
          const found = jobsList.find((j: any) => String(j.id) === String(targetJobId));
          if (found) {
            result.status = "active_api_list";
            result.source = "greenhouse_all_jobs_api";
            result.job = found;
            const decodedContent = decodeHtmlEntities(found.content || "");
            result.rawHtml = decodedContent;
            result.plainText = decodedContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            result.links = extractLinksFromContent(decodedContent, result.plainText);
            return res.json(result);
          }
        }
        
        result.sampleActiveJobs = jobsList.slice(0, 8).map((j: any) => ({
          id: j.id,
          title: j.title,
          location: j.location?.name,
          updated_at: j.updated_at,
          absolute_url: j.absolute_url,
        }));
      }
    } catch (err: any) {
      // Continue to archive fallback
    }

    // Step 3: Check Wayback Machine CDX API & Availability
    const candidateUrls = [
      `https://job-boards.greenhouse.io/${targetBoard}/jobs/${targetJobId}`,
      `https://boards.greenhouse.io/${targetBoard}/jobs/${targetJobId}`,
      `job-boards.greenhouse.io/${targetBoard}/jobs/${targetJobId}`,
      `boards.greenhouse.io/${targetBoard}/jobs/${targetJobId}`,
    ];

    let foundArchiveSnapshot: any = null;

    for (const testUrl of candidateUrls) {
      try {
        const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(testUrl)}&output=json&limit=5&fl=timestamp,original,statuscode,mimetype`;
        const cdxResp = await fetch(cdxUrl, {
          headers: { "User-Agent": "GreenhouseJobExtractor/1.0" },
        });

        if (cdxResp.ok) {
          const cdxData = await cdxResp.json();
          if (Array.isArray(cdxData) && cdxData.length > 1) {
            // Header is first row [timestamp, original, statuscode, mimetype]
            const snapshots = cdxData.slice(1).map((row: any[]) => ({
              timestamp: row[0],
              original: row[1],
              statuscode: row[2],
              mimetype: row[3],
              archiveUrl: `https://web.archive.org/web/${row[0]}/${row[1]}`,
              rawContentUrl: `https://web.archive.org/web/${row[0]}if_/${row[1]}`,
            }));

            result.archiveSnapshots = snapshots;
            foundArchiveSnapshot = snapshots[snapshots.length - 1]; // most recent
            break;
          }
        }
      } catch (err) {
        // Try next
      }
    }

    // Also check wayback availability API if CDX didn't return snapshot
    if (!foundArchiveSnapshot && targetJobId) {
      try {
        const waybackAvailUrl = `https://archive.org/wayback/available?url=https://job-boards.greenhouse.io/${targetBoard}/jobs/${targetJobId}`;
        const availResp = await fetch(waybackAvailUrl);
        if (availResp.ok) {
          const availData = await availResp.json();
          if (availData.archived_snapshots?.closest?.available) {
            const closest = availData.archived_snapshots.closest;
            foundArchiveSnapshot = {
              timestamp: closest.timestamp,
              original: closest.url,
              statuscode: closest.status,
              archiveUrl: closest.url,
              rawContentUrl: closest.url.replace("/web/", `/web/${closest.timestamp}if_/`),
            };
            result.archiveSnapshots.push(foundArchiveSnapshot);
          }
        }
      } catch (err) {
        // Fallback continues
      }
    }

    // Step 4: If archive snapshot found, fetch the archived HTML content
    if (foundArchiveSnapshot) {
      try {
        const fetchTarget = foundArchiveSnapshot.rawContentUrl || foundArchiveSnapshot.archiveUrl;
        const archiveFetchResp = await fetch(fetchTarget, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
          },
        });

        if (archiveFetchResp.ok) {
          const archiveHtml = await archiveFetchResp.text();
          result.status = "archived_recovered";
          result.source = "wayback_machine";
          result.archiveTimestamp = foundArchiveSnapshot.timestamp;
          result.archiveUrl = foundArchiveSnapshot.archiveUrl;
          result.rawHtml = archiveHtml;
          
          // Try to extract title, location, and job body from Greenhouse archived HTML
          const titleMatch = archiveHtml.match(/<h1[^>]*class=["']app-title["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                             archiveHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                             archiveHtml.match(/<title>([\s\S]*?)<\/title>/i);
          
          const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : `Job #${targetJobId}`;

          const contentMatch = archiveHtml.match(/<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i) ||
                              archiveHtml.match(/<div[^>]*class=["']job-description["'][^>]*>([\s\S]*?)<\/div>/i) ||
                              archiveHtml.match(/<div[^>]*id=["']job-details["'][^>]*>([\s\S]*?)<\/div>/i);

          const mainHtml = contentMatch ? contentMatch[1] : archiveHtml;
          result.job = {
            id: targetJobId,
            title,
            isArchived: true,
            archiveUrl: foundArchiveSnapshot.archiveUrl,
            timestamp: foundArchiveSnapshot.timestamp,
          };
          result.plainText = mainHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
                                     .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
                                     .replace(/<[^>]+>/g, " ")
                                     .replace(/\s+/g, " ")
                                     .trim();
          result.links = extractLinksFromContent(mainHtml, result.plainText);
          return res.json(result);
        }
      } catch (err: any) {
        result.archiveFetchError = err.message;
      }
    }

    // If neither live API nor archive was found, provide helpful diagnostics & search links
    result.status = "not_found_or_expired";
    result.googleSearchUrls = [
      `https://www.google.com/search?q=${encodeURIComponent(`site:job-boards.greenhouse.io/${targetBoard} ${targetJobId}`)}`,
      `https://www.google.com/search?q=${encodeURIComponent(`site:boards.greenhouse.io/${targetBoard} ${targetJobId}`)}`,
      `https://www.google.com/search?q=${encodeURIComponent(`site:greenhouse.io "${targetBoard}" "${targetJobId}"`)}`,
    ];
    result.waybackSearchUrl = `https://web.archive.org/web/*/${candidateUrls[0]}`;

    return res.json(result);
  } catch (error: any) {
    console.error("Error in /api/greenhouse/fetch:", error);
    return res.status(500).json({ error: error.message || "Failed to process Greenhouse request." });
  }
});

// 2. Fetch Board Overview & Job List
app.get("/api/greenhouse/board/:boardToken", async (req, res) => {
  try {
    const { boardToken } = req.params;
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
    
    const apiResponse = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        error: `Greenhouse API returned ${apiResponse.status}: ${apiResponse.statusText}`,
      });
    }

    const data = await apiResponse.json();
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. AI Analysis & Extraction using Gemini 3.7 Flash
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { text, links, jobTitle, company, mode } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured.",
      });
    }

    let prompt = "";
    if (mode === "summarize_links") {
      prompt = `Analyze this job posting for ${jobTitle || "the role"} at ${company || "the company"} and inspect the following extracted links:
Links: ${JSON.stringify(links, null, 2)}
Job text snippet:
${text?.slice(0, 4000)}

Please provide:
1. Role Summary & Core Requirements (Key qualifications, tech stack, responsibilities)
2. Link Intelligence (Explain the purpose of every link found, how to apply directly, whether there are external tests/calendars/forms/emails)
3. Direct Contact & Recruiter Outreach Advice (Tips for applying if the posting is closed or redirected)
4. Hidden signals or compensation details mentioned.`;
    } else if (mode === "outreach_letter") {
      prompt = `Draft a compelling, professional cold email / LinkedIn outreach message to a recruiter or hiring manager at ${company || "the company"} for the role: "${jobTitle || "this position"}".
Mention that you are aware the job posting on Greenhouse (${company}) was previously listed/updated and you are eager to connect regarding fit.
Job Details:
${text?.slice(0, 3000)}`;
    } else {
      prompt = `Review this job description for ${jobTitle || "Role"} at ${company || "Company"}:
${text?.slice(0, 4000)}

Extract:
1. Must-have vs Nice-to-have skills
2. Key performance indicators / expected deliverables
3. Direct application recommendations & link audit`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert technical recruiting and job search intelligence assistant specializing in Greenhouse ATS job boards and application strategy.",
      },
    });

    return res.json({ analysis: response.text });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// VITE & STATIC FILE SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Greenhouse Extractor running on http://localhost:${PORT}`);
  });
}

startServer();
