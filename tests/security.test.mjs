import test from "node:test";
import assert from "node:assert/strict";
import { senderRole, assertWorkerCommand } from "../shared/security.js";

const id = "a".repeat(32);
const own = (path, extra = {}) => ({ id, url: `chrome-extension://${id}/${path}`, ...extra });
const content = { id, url: "https://example.com/", tab: { id: 7 }, frameId: 0 };

test("sender roles use extension identity, exact resource path and frame ownership", () => {
  assert.equal(senderRole(own("studio/studio.html", { tab: { id: 3 }, frameId: 0 }), id), "studio");
  assert.equal(senderRole(own("offscreen/offscreen.html"), id), "offscreen");
  assert.equal(senderRole(own("service-worker.js"), id), "worker");
  assert.equal(senderRole(own("service-worker.js", { tab: { id: 3 } }), id), null);
  assert.equal(senderRole(own("studio/studio.html", { frameId: 2 }), id), null);
  assert.equal(senderRole(own("studio/studio.html.evil"), id), null);
  assert.equal(senderRole({ ...own("studio/studio.html"), id: "b".repeat(32) }, id), null);
  assert.equal(senderRole({ id, url: "https://example.com/studio/studio.html" }, id), null);
});

test("content scripts can only transition their own fullscreen route", () => {
  assert.equal(assertWorkerCommand({ type: "prepare-fullscreen", tabId: 7 }, content, id), "content");
  for (const type of ["start-route", "update-mix", "save-scene", "studio-levels", "route-state-changed", "get-studio-state"]) {
    assert.throws(() => assertWorkerCommand({ type, tabId: 7 }, content, id), /cannot control/);
  }
  assert.throws(() => assertWorkerCommand({ type: "resume-fullscreen", tabId: 8 }, content, id));
  assert.throws(() => assertWorkerCommand({ type: "prepare-fullscreen" }, { ...content, frameId: 1 }, id));
});

test("capture remains a toolbar action and engine events cannot be forged by UI", () => {
  assert.equal(assertWorkerCommand({ type: "start-route" }, own("popup/popup.html"), id), "popup");
  assert.throws(() => assertWorkerCommand({ type: "start-route" }, own("studio/studio.html"), id));
  assert.throws(() => assertWorkerCommand({ type: "studio-state-changed" }, own("studio/studio.html"), id));
  assert.equal(assertWorkerCommand({ type: "studio-state-changed" }, own("offscreen/offscreen.html"), id), "offscreen");
  assert.equal(assertWorkerCommand({ type: "change-output" }, own("setup/setup.html"), id), "setup");
  assert.throws(() => assertWorkerCommand({ type: "save-scene" }, own("setup/setup.html"), id));
});
