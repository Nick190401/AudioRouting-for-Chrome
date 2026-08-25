export async function connectToBrowser(port) {
  const versionResponse = await fetch(`http://127.0.0.1:${port}/json/version`);
  if (!versionResponse.ok) throw new Error(`Chrome DevTools is unavailable: ${versionResponse.status}`);
  const version = await versionResponse.json();
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  const pending = new Map();
  let commandId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
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

  return {
    command(method, params = {}) {
      const id = ++commandId;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}
