import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const KB_REPO = process.env.KB_REPO ?? "ofsng/teknoloji";
export const PROJECT_ROOT = path.resolve(import.meta.dirname, "..", "..");

export function git(cwd: string, ...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function isKb(dir: string): boolean {
  return fs.existsSync(path.join(dir, "TAXONOMY.md")) && fs.existsSync(path.join(dir, "tools", "kb.py"));
}

/**
 * Bilgi tabanı klasörü: KB_DIR → ../Technology-Knowledge-Base → .kb (yoksa klonlanır).
 * KB_REF verilirse klon o dala/etikete göre alınır. Bilgi tabanına hiçbir şey yazılmaz.
 */
export function resolveKb(): string {
  if (process.env.KB_DIR) {
    const d = path.resolve(process.env.KB_DIR);
    if (!isKb(d)) throw new Error(`KB_DIR bir bilgi tabanı klasörü değil: ${d}`);
    return d;
  }
  const sibling = path.resolve(PROJECT_ROOT, "..", "Technology-Knowledge-Base");
  if (isKb(sibling)) return sibling;
  const local = path.join(PROJECT_ROOT, ".kb");
  if (!isKb(local)) {
    console.log(`Bilgi tabanı klonlanıyor: https://github.com/${KB_REPO}`);
    fs.rmSync(local, { recursive: true, force: true });
    const ref = process.env.KB_REF;
    execFileSync("git", ["clone", "--depth", "1", ...(ref ? ["--branch", ref] : []), `https://github.com/${KB_REPO}.git`, local], { stdio: "inherit" });
  }
  return local;
}
