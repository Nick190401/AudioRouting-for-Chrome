const [port = "9335", extensionId] = process.argv.slice(2);
if (!extensionId) throw new Error("Eine Extension-ID ist erforderlich.");

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const worker = targets.find(
  (target) => target.type === "service_worker" && target.url === `chrome-extension://${extensionId}/service-worker.js`,
);
if (!worker) throw new Error("AudioRoute service worker was not found.");

const socket = new WebSocket(worker.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let commandId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    exceptions.push({
      text: details?.text || "Unknown runtime exception",
      description: details?.exception?.description || null,
      url: details?.url || null,
      line: typeof details?.lineNumber === "number" ? details.lineNumber + 1 : null,
    });
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await command("Runtime.enable");
const result = await command("Runtime.evaluate", {
  expression: `({
    manifest: chrome.runtime.getManifest(),
    tabCapture: typeof chrome.tabCapture?.getMediaStreamId,
    offscreen: typeof chrome.offscreen?.createDocument,
    storage: typeof chrome.storage?.local?.get
  })`,
  returnByValue: true,
});
await new Promise((resolve) => setTimeout(resolve, 250));

console.log(JSON.stringify({
  worker: worker.url,
  capabilities: result.result.value,
  runtimeExceptions: exceptions,
}, null, 2));
socket.close();
