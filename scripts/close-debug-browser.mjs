import { connectToBrowser } from "./cdp-command.mjs";

const [port = "9334"] = process.argv.slice(2);
const client = await connectToBrowser(port);
await client.command("Browser.close");
client.close();
