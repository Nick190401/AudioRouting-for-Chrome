(() => {
  const existingBridge = globalThis.__audioRouteFullscreenBridge;
  if (existingBridge) {
    existingBridge.activate();
    return;
  }

  const state = {
    active: false,
    pending: null,
    resumeTimer: null,
  };

  const fullscreenTerms = /(?:full[ -]?screen|fullscreen|vollbild|plein écran|pantalla completa|schermo intero|全屏|フルスクリーン)/i;
  const knownControlSelector = [
    ".ytp-fullscreen-button",
    ".vjs-fullscreen-control",
    ".jw-icon-fullscreen",
    ".shaka-fullscreen-button",
    "[data-plyr='fullscreen']",
    "[data-testid*='fullscreen' i]",
    "[data-fullscreen]",
  ].join(",");

  const bridge = {
    activate() {
      state.active = true;
    },
    deactivate() {
      state.active = false;
      void resumeRoute();
    },
  };

  Object.defineProperty(globalThis, "__audioRouteFullscreenBridge", {
    value: bridge,
    configurable: true,
  });

  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("fullscreenchange", handleFullscreenChange, true);
  bridge.activate();

  function handlePointerDown(event) {
    if (!state.active || state.pending || document.fullscreenElement) return;
    if (!isFullscreenIntent(event)) return;

    state.pending = chrome.runtime.sendMessage({
      target: "audio-route-worker",
      type: "prepare-fullscreen",
    });

    clearTimeout(state.resumeTimer);
    state.resumeTimer = setTimeout(() => void resumeRoute(), 900);
  }

  function handleFullscreenChange() {
    if (!state.pending) return;
    clearTimeout(state.resumeTimer);
    state.resumeTimer = setTimeout(() => void resumeRoute(), 90);
  }

  async function resumeRoute() {
    clearTimeout(state.resumeTimer);
    state.resumeTimer = null;

    const pending = state.pending;
    state.pending = null;
    if (!pending) return;

    try {
      const prepared = await pending;
      if (!prepared?.ok || !prepared.transition?.suspended) return;
      await chrome.runtime.sendMessage({
        target: "audio-route-worker",
        type: "resume-fullscreen",
      });
    } catch {
      // Routing errors remain visible in the AudioRoute popup.
    }
  }

  function isFullscreenIntent(event) {
    const path = event.composedPath();

    for (const node of path) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.(knownControlSelector) || node.closest?.(knownControlSelector)) return true;

      const descriptor = [
        node.getAttribute?.("aria-label"),
        node.getAttribute?.("title"),
        node.getAttribute?.("data-title-no-tooltip"),
        node.getAttribute?.("data-tooltip-text"),
        node.id,
        typeof node.className === "string" ? node.className : "",
      ].filter(Boolean).join(" ");
      if (fullscreenTerms.test(descriptor)) return true;
    }

    const video = path.find((node) => node instanceof HTMLVideoElement && node.controls);
    if (!video) return false;
    const rect = video.getBoundingClientRect();
    return event.clientY >= rect.bottom - 64 && event.clientX >= rect.right - 96;
  }
})();
