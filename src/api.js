const allowed = new Set(["declaration-1776", "constitution-1787", "rome-negotiations-49bce"]);
export const base = import.meta.env?.BASE_URL || "/HistoryForge/";
export function dataPath(path, body) {
  if (body !== undefined)
    throw new Error("This public collection is read-only.");
  const url = new URL(path, "https://history-forge.invalid");
  if (url.pathname === "/api/tapestry") return base + "data/tapestry.json";
  if (url.pathname === "/api/corpus") {
    const dossier = url.searchParams.get("dossier");
    if (
      url.searchParams.getAll("dossier").length !== 1 ||
      !allowed.has(dossier)
    )
      throw new Error("That dossier is not part of this public release.");
    return base + "data/" + dossier + ".json";
  }
  throw new Error("That operation is not available in the public collection.");
}
export async function request(path, body, signal) {
  const response = await fetch(dataPath(path, body), { signal });
  if (!response.ok)
    throw new Error("The public evidence file could not be loaded.");
  return response.json();
}
