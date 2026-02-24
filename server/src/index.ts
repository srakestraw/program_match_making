import path from "node:path";
import dotenv from "dotenv";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachPhoneWebsocketServer } from "./phone/index.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const app = createApp();
const port = Number(process.env.PORT || 4000);
const server = createServer(app);
attachPhoneWebsocketServer(server);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
