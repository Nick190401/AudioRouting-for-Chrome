import { resolve } from "node:path";
import { connectToBrowser } from "./cdp-command.mjs";

const [port = "9334", extensionPath = "."] = process.argv.slice(2);
const client = await connectToBrowser(port);

try {
  const loaded = await client.command("Extensions.loadUnpacked", {
    path: resolve(extensionPath),
    enableInIncognito: false,
  });
  const installed = await client.command("Extensions.getExtensions");
  console.log(JSON.stringify({ loaded, installed: installed.extensions }, null, 2));
} finally {
  client.close();
}
