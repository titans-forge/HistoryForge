import fs from "node:fs";
import path from "node:path";
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const blocks = [
  "History Forge: bundled production dependency license texts",
  "Generated from package-lock.json. Each dependency retains its own license.",
];
for (const [location, item] of Object.entries(lock.packages)) {
  if (!location || item.dev) continue;
  const root = path.resolve(location);
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const files = fs
    .readdirSync(root)
    .filter((name) => /^(licen[sc]e|copying)([.-].*)?$/i.test(name));
  if (!files.length) throw new Error("Missing license file: " + location);
  blocks.push(
    "\n============================================================\n" +
      packageJson.name +
      " " +
      packageJson.version +
      " (" +
      packageJson.license +
      ")",
  );
  for (const name of files)
    blocks.push(fs.readFileSync(path.join(root, name), "utf8"));
}
fs.mkdirSync("licenses", { recursive: true });
fs.writeFileSync("licenses/dependencies.txt", blocks.join("\n\n") + "\n");
console.log("Preserved notices for all production dependencies.");
