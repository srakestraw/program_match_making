import path from "node:path";
import dotenv from "dotenv";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachPhoneWebsocketServer } from "./phone/index.js";
import { isLangfuseEnabled, shutdownLangfuse } from "./lib/langfuse.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const app = createApp();
const port = Number(process.env.PORT || 4000);
const server = createServer(app);
attachPhoneWebsocketServer(server);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  if (isLangfuseEnabled()) {
    console.log("Langfuse tracing enabled");
  }
});

const gracefulShutdown = async () => {
  server.close(async () => {
    await shutdownLangfuse();
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void gracefulShutdown();
});

process.on("SIGTERM", () => {
  void gracefulShutdown();
});
