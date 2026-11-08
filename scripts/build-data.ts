// Bilgi tabanından (ofsng/teknoloji) statik JSON indeksleri üretir: public/data/
//   atlas.json      — tüm düğümler (sıkıştırılmış), araştırma metadata'sı, istatistikler
//   n/<id>.json     — düğüm açıklaması (Markdown → güvenli HTML), kaynaklar
//   r/<anahtar>.json — araştırma kaydının bölümleri ve metadata'sı

import fs from "node:fs";
import path from "node:path";
import { buildAtlas, toWire } from "./lib/atlas";
import { KB_REPO, PROJECT_ROOT, git, resolveKb } from "./lib/source";

const OUT = path.join(PROJECT_ROOT, "public", "data");

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

const kb = resolveKb();
const commit = git(kb, "rev-parse", "HEAD");
const commitDate = git(kb, "log", "-1", "--format=%cI");
const t0 = Date.now();
const { atlas, details, researchDetails, warnings } = buildAtlas(kb, { repo: KB_REPO, commit, commitDate });

fs.rmSync(OUT, { recursive: true, force: true });
writeJson(path.join(OUT, "atlas.json"), toWire(atlas));
for (const d of details) writeJson(path.join(OUT, "n", `${d.id}.json`), d);
for (const d of researchDetails) writeJson(path.join(OUT, "r", `${d.key}.json`), d);

for (const w of warnings) console.warn(`uyarı: ${w}`);
const size = (fs.statSync(path.join(OUT, "atlas.json")).size / 1024).toFixed(0);
console.log(
  `Veri hazır: ${atlas.stats.nodes} düğüm, ${atlas.stats.research} araştırma, ${atlas.stats.relations} ilişki ` +
    `(${kb}, ${commit?.slice(0, 7) ?? "git yok"}) — atlas.json ${size} KB, ${Date.now() - t0} ms`,
);
if (process.env.KB_STRICT && warnings.length) {
  console.error(`KB_STRICT: ${warnings.length} uyarı`);
  process.exit(1);
}
