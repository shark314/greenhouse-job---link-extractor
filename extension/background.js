chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-inspector") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "GH_TOGGLE_PANEL" }).catch(() => {});
});
