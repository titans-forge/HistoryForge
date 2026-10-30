import fs from "node:fs";
fs.mkdirSync("public/legal", { recursive: true });
for (const name of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"])
  fs.copyFileSync(name, "public/legal/" + name);
fs.copyFileSync("licenses/dependencies.txt", "public/legal/dependencies.txt");
