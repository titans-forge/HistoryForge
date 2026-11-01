import fs from "node:fs";
fs.mkdirSync("public/legal", { recursive: true });
for (const name of [
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "HISTORY_FORGE_DATA_LICENSE.md",
  "LICENSING.md",
  "COMMERCIAL_AGENT_TRAINING.md",
])
  fs.copyFileSync(name, "public/legal/" + name);
fs.copyFileSync("licenses/dependencies.txt", "public/legal/dependencies.txt");
