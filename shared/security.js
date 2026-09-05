const UI_PATHS = new Set(["/popup/popup.html", "/studio/studio.html", "/setup/setup.html"]);

export function senderRole(sender, extensionId) {
  if (!sender || sender.id !== extensionId || typeof sender.url !== "string") return null;
  let url;
  try { url = new URL(sender.url); } catch { return null; }
  if (url.protocol === "chrome-extension:" && url.hostname === extensionId) {
    if (sender.frameId && sender.frameId !== 0) return null;
    if (UI_PATHS.has(url.pathname)) return url.pathname.split("/")[1];
    if (sender.tab) return null;
    if (url.pathname === "/service-worker.js") return "worker";
    if (url.pathname === "/offscreen/offscreen.html") return "offscreen";
    return null;
  }
  if (["http:", "https:", "file:"].includes(url.protocol) &&
      Number.isInteger(sender.tab?.id) && sender.tab.id >= 0 && sender.frameId === 0) return "content";
  return null;
}

export function assertWorkerCommand(message, sender, extensionId) {
  const role = senderRole(sender, extensionId);
  const type = message?.type;
  if (typeof type !== "string") throw new Error("Invalid AudioRoute request.");
  if (["route-state-changed", "studio-state-changed", "studio-levels"].includes(type)) {
    if (role === "offscreen") return role;
  } else if (["prepare-fullscreen", "resume-fullscreen"].includes(type)) {
    if (role === "content" && (message.tabId === undefined || message.tabId === sender.tab.id)) return role;
  } else if (type === "start-route") {
    if (role === "popup") return role;
  } else if (role === "popup" || role === "studio") {
    return role;
  } else if (role === "setup" && ["change-output", "get-route-state"].includes(type)) {
    return role;
  }
  throw new Error("This context cannot control AudioRoute.");
}
