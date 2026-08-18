const statusPill = document.getElementById("statusPill");
const toggleBtn = document.getElementById("toggleBtn");

function describeStatus(status) {
  if (!status) {
    return { text: "Open a Greenhouse job page to extract the description.", warn: true };
  }

  const board = status.board || "unknown board";
  const jobBit = status.jobId ? ` · job ${status.jobId}` : "";
  const titleBit = status.title ? `\n${status.title}` : "";
  const sourceBit = status.source ? `\nSource: ${status.source}` : "";
  const panelBit = status.panelOpen ? "Panel open" : "Panel collapsed";
  const linkBit = typeof status.linkCount === "number" ? ` · ${status.linkCount} links` : "";

  return {
    text: `${panelBit}${linkBit}\nBoard: ${board}${jobBit}${titleBit}${sourceBit}`,
    warn: !status.board,
  };
}

async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  return chrome.tabs.sendMessage(tab.id, { type });
}

async function refreshStatus() {
  try {
    const status = await sendToActiveTab("GH_GET_STATUS");
    const view = describeStatus(status);
    statusPill.textContent = view.text;
    statusPill.classList.toggle("warn", view.warn);
    toggleBtn.disabled = !status;
    toggleBtn.textContent = status?.panelOpen ? "Collapse panel" : "Open panel";
  } catch {
    statusPill.textContent = "This tab is not a Greenhouse page (or the content script is not loaded yet).";
    statusPill.classList.add("warn");
    toggleBtn.disabled = true;
    toggleBtn.textContent = "Toggle panel";
  }
}

toggleBtn.addEventListener("click", async () => {
  try {
    const status = await sendToActiveTab("GH_TOGGLE_PANEL");
    const view = describeStatus(status);
    statusPill.textContent = view.text;
    statusPill.classList.toggle("warn", view.warn);
    toggleBtn.textContent = status?.panelOpen ? "Collapse panel" : "Open panel";
  } catch {
    statusPill.textContent = "Could not toggle the on-page panel.";
    statusPill.classList.add("warn");
  }
});

refreshStatus();
