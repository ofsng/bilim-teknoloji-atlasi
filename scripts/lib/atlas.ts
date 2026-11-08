import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseFrontmatter, str, list, normTitle, type Meta } from "./frontmatter";
import { renderMarkdown, type LinkContext } from "./markdown";
import type {
  Atlas, AtlasStats, AtlasWire, NodeDetail, NodeType, RelKind, ResearchDetail, ResearchItem, Section, TechNode,
} from "../../src/lib/types";
import { REL_KINDS } from "../../src/lib/types";

// kb.py ile aynı tarama kuralları
const INDEX = "_index.md";
const RESEARCH_DIR = "Arastirmalar";
const SKIP_ROOT = new Set(["tools", "templates", "review", "state", "research-index", RESEARCH_DIR]);
const HEADING_RE = /^## (\d+)\. (.+?)[ \t]*$/gm;
const AUTO_BLOCK_RE = /<!-- AUTO:(?:\w+:)?BEGIN[\s\S]*?<!-- AUTO:(?:\w+:)?END -->/g;

export const INDEX_SECTION_TITLES: Record<number, string> = {
  1: "Tanım", 2: "Çalışma prensibi", 3: "Tarihçe", 4: "Temel kavramlar", 5: "Temel yöntemler",
  6: "Alt teknolojiler", 7: "İlişkili teknolojiler", 8: "Kullanım alanları", 9: "Avantajlar",
  10: "Sınırlılıklar", 11: "Açık problemler", 12: "Önemli araştırmalar", 13: "Güncel gelişmeler", 14: "Kaynaklar",
};
/** 6 ve 7 tamamen otomatik üretilir; arayüz bunları hiyerarşi ve ilişki verisinden gösterir. */
const AUTO_ONLY_SECTIONS = new Set([6, 7]);

export function isPlaceholder(content: string): boolean {
  const c = content.trim();
  return (
    !c ||
    c.startsWith("_Henüz doldurulmadı") ||
    c.startsWith("_Tam metin incelenmedi")
  );
}

export function stripAutoBlocks(body: string): string {
  return body.replace(AUTO_BLOCK_RE, "");
}

export function splitSections(body: string): { n: number; title: string; content: string }[] {
  const matches = [...body.matchAll(HEADING_RE)];
  return matches.map((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    return { n: parseInt(m[1], 10), title: m[2], content: body.slice(start, end).trim() };
  });
}

export function researchKey(rid: string): string {
  return crypto.createHash("sha1").update(rid).digest("hex").slice(0, 10);
}

interface RawNode {
  id: string;
  meta: Meta;
  body: string;
  dir: string;
  depth: number;
  parent: string | null;
  children: string[];
  research: RawResearch[];
}

interface RawResearch {
  path: string;
  meta: Meta;
  body: string;
  tech: string;
}

export interface ScanResult {
  nodes: Map<string, RawNode>;
  byDir: Map<string, string>;
  roots: string[];
  research: RawResearch[];
  orphans: string[];
  duplicates: [string, string, string][];
}

/** kb.py Tree.scan ile aynı: hiyerarşi klasör yapısından gelir. */
export function scanKb(root: string): ScanResult {
  const nodes = new Map<string, RawNode>();
  const byDir = new Map<string, string>();
  const research: RawResearch[] = [];
  const orphans: string[] = [];
  const duplicates: [string, string, string][] = [];

  const walk = (rel: string) => {
    const abs = rel ? path.join(root, rel) : root;
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    if (rel) {
      const hasIndex = entries.some((e) => e.isFile() && e.name === INDEX);
      if (!hasIndex) orphans.push(rel);
      else {
        const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(abs, INDEX), "utf8"));
        const id = str(meta.id) ?? `<idsiz:${rel}>`;
        if (nodes.has(id)) duplicates.push([id, nodes.get(id)!.dir, rel]);
        else {
          const node: RawNode = { id, meta, body, dir: rel, depth: rel.split("/").length, parent: null, children: [], research: [] };
          nodes.set(id, node);
          byDir.set(rel, id);
          const rdir = path.join(abs, RESEARCH_DIR);
          if (fs.existsSync(rdir) && fs.statSync(rdir).isDirectory()) {
            for (const f of fs.readdirSync(rdir).sort()) {
              if (!f.endsWith(".md")) continue;
              const p = path.join(rdir, f);
              const parsed = parseFrontmatter(fs.readFileSync(p, "utf8"));
              const r: RawResearch = { path: `${rel}/${RESEARCH_DIR}/${f}`, meta: parsed.meta, body: parsed.body, tech: id };
              node.research.push(r);
              research.push(r);
            }
          }
        }
      }
    }
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((d) => !d.startsWith(".") && !d.startsWith("_") && !(rel === "" && SKIP_ROOT.has(d)) && d !== RESEARCH_DIR)
      .sort();
    for (const d of dirs) walk(rel ? `${rel}/${d}` : d);
  };
  walk("");

  const roots: string[] = [];
  for (const n of nodes.values()) {
    const pd = path.posix.dirname(n.dir);
    if (pd === ".") {
      n.parent = null;
      roots.push(n.id);
    } else {
      const pid = byDir.get(pd);
      n.parent = pid ?? null;
      if (pid) nodes.get(pid)!.children.push(n.id);
    }
  }
  const key = (id: string) => normTitle(str(nodes.get(id)!.meta.title_tr) ?? id);
  const cmp = (a: string, b: string) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  roots.sort(cmp);
  for (const n of nodes.values()) n.children.sort(cmp);
  return { nodes, byDir, roots, research, orphans, duplicates };
}

function researchYear(m: Meta): number | null {
  if (typeof m.year === "number") return m.year;
  if (m.year && /^\d+$/.test(String(m.year))) return parseInt(String(m.year), 10);
  const pd = str(m.published_date) ?? "";
  return /^\d{4}/.test(pd) ? parseInt(pd.slice(0, 4), 10) : null;
}

function bool(v: unknown): boolean | null {
  return v === true ? true : v === false ? false : null;
}

export interface BuildOptions {
  repo: string;
  commit: string | null;
  commitDate: string | null;
  generatedAt?: string;
}

export interface BuildOutput {
  atlas: Atlas;
  details: NodeDetail[];
  researchDetails: ResearchDetail[];
  warnings: string[];
}

export function buildAtlas(root: string, opts: BuildOptions): BuildOutput {
  const scan = scanKb(root);
  const warnings: string[] = [];
  for (const o of scan.orphans) warnings.push(`_index.md olmayan klasör: ${o}`);
  for (const [id, a, b] of scan.duplicates) warnings.push(`Yinelenen kimlik ${id}: ${a} ve ${b}`);

  const researchByPath = new Map<string, string>();
  const researchKeys = new Set<string>();
  for (const r of scan.research) {
    const rid = str(r.meta.research_id) ?? `path:${r.path}`;
    const k = researchKey(rid);
    if (researchKeys.has(k)) warnings.push(`Yinelenen araştırma anahtarı: ${rid}`);
    researchKeys.add(k);
    researchByPath.set(r.path, k);
  }
  const blobBase = `https://github.com/${opts.repo}/blob/${opts.commit ?? "main"}`;
  const ctxFor = (dir: string): LinkContext => ({ dir, techByDir: scan.byDir, researchByPath, repoBlobBase: blobBase });

  // Alt ağaç sayıları
  const resAll = new Map<string, number>();
  const desc = new Map<string, number>();
  const disc = new Map<string, string>();
  const visit = (id: string, top: string): [number, number] => {
    const n = scan.nodes.get(id)!;
    disc.set(id, top);
    let r = n.research.length;
    let d = 0;
    for (const c of n.children) {
      const [cr, cd] = visit(c, top);
      r += cr;
      d += cd + 1;
    }
    resAll.set(id, r);
    desc.set(id, d);
    return [r, d];
  };
  for (const t of scan.roots) visit(t, t);

  const nodes: TechNode[] = [];
  const details: NodeDetail[] = [];
  // Ağaç sırasıyla (derinlik öncelikli) yaz; arayüzde ve testlerde deterministik sıra.
  const order: string[] = [];
  const pushOrder = (id: string) => {
    order.push(id);
    for (const c of scan.nodes.get(id)!.children) pushOrder(c);
  };
  scan.roots.forEach(pushOrder);

  for (const id of order) {
    const n = scan.nodes.get(id)!;
    const m = n.meta;
    const rel = Object.fromEntries(
      REL_KINDS.map((k) => [k, list(m[k]).filter((t) => {
        if (!scan.nodes.has(t)) warnings.push(`${id}.${k}: bilinmeyen kimlik ${t}`);
        return scan.nodes.has(t);
      })]),
    ) as Record<RelKind, string[]>;
    nodes.push({
      id,
      tr: str(m.title_tr) ?? str(m.title) ?? id,
      en: str(m.title) ?? "",
      type: (str(m.type) as NodeType) ?? "technology",
      parent: n.parent,
      depth: n.depth,
      disc: disc.get(id)!,
      status: str(m.status) ?? "established",
      conf: str(m.classification_confidence) ?? "high",
      aliases: list(m.aliases),
      rel,
      content: str(m.content_status) ?? "empty",
      verified: m.content_verified === true,
      children: n.children,
      res: n.research.length,
      resAll: resAll.get(id)!,
      desc: desc.get(id)!,
      path: n.dir,
    });
    if (str(m.parent) && str(m.parent) !== (n.parent ?? "root")) {
      warnings.push(`${id}: ön bilgideki parent (${str(m.parent)}) klasör yapısıyla uyuşmuyor (${n.parent ?? "root"})`);
    }

    const ctx = ctxFor(n.dir);
    const sections: Section[] = [];
    const emptySections: string[] = [];
    for (const s of splitSections(stripAutoBlocks(n.body))) {
      if (AUTO_ONLY_SECTIONS.has(s.n)) continue;
      const title = INDEX_SECTION_TITLES[s.n] ?? s.title;
      if (isPlaceholder(s.content)) emptySections.push(title);
      else sections.push({ n: s.n, title, html: renderMarkdown(s.content, ctx) });
    }
    details.push({
      id,
      path: n.dir,
      sections,
      emptySections,
      contentSources: list(m.content_sources),
      classificationRefs: list(m.classification_refs),
      contentMode: str(m.content_mode),
      created: str(m.created),
      lastMaintained: str(m.last_maintained),
    });
  }

  const research: ResearchItem[] = [];
  const researchDetails: ResearchDetail[] = [];
  for (const r of scan.research) {
    const m = r.meta;
    const key = researchByPath.get(r.path)!;
    const primary = str(m.primary_technology) ?? str(m.technology_id);
    if (primary && primary !== r.tech) warnings.push(`${r.path}: primary_technology (${primary}) klasörle uyuşmuyor (${r.tech})`);
    research.push({
      key,
      rid: str(m.research_id) ?? "",
      title: str(m.title) ?? path.posix.basename(r.path, ".md"),
      authors: list(m.authors),
      authorsTruncated: m.authors_truncated === true,
      year: researchYear(m),
      date: str(m.published_date),
      doi: str(m.doi),
      arxiv: str(m.arxiv),
      url: str(m.url),
      publication: str(m.publication),
      pubType: str(m.publication_type),
      peer: bool(m.peer_reviewed),
      // Klasör kanonik konumdur (kb.py ile aynı).
      tech: r.tech,
      related: list(m.related_technologies).filter((t) => scan.nodes.has(t) && t !== r.tech),
      cited: typeof m.cited_by_count === "number" ? m.cited_by_count : null,
      retraction: str(m.retraction_status),
      contentStatus: str(m.content_status),
      idVerified: m.identifier_verified === false ? "false" : str(m.identifier_verified),
      method: str(m.classification_method),
      path: r.path,
    });
    const ctx = ctxFor(path.posix.dirname(r.path));
    const sections: Section[] = [];
    for (const s of splitSections(stripAutoBlocks(r.body))) {
      if (isPlaceholder(s.content)) continue;
      sections.push({ n: s.n, title: s.title, html: renderMarkdown(s.content, ctx) });
    }
    researchDetails.push({
      key,
      sections,
      keywords: list(m.keywords),
      abstractLicense: str(m.abstract_license),
      sourceIds: list(m.source_ids),
      relatedVersions: list(m.related_versions),
      collectedAt: str(m.collected_at),
      lastCheckedAt: str(m.last_checked_at),
      retractionChecked: str(m.retraction_checked),
    });
  }

  const atlas: Atlas = {
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    source: { repo: opts.repo, commit: opts.commit, commitDate: opts.commitDate },
    stats: computeStats(nodes, research, scan.roots),
    roots: scan.roots,
    nodes,
    research,
  };
  return { atlas, details, researchDetails, warnings };
}

function inc(o: Record<string, number>, k: string) {
  o[k] = (o[k] ?? 0) + 1;
}

export function toWire(atlas: Atlas): AtlasWire {
  return {
    ...atlas,
    nodes: atlas.nodes.map(({ children: _c, path: _p, rel, ...rest }) => {
      const r = Object.fromEntries(REL_KINDS.filter((k) => rel[k].length).map((k) => [k, rel[k]]));
      return Object.keys(r).length ? { ...rest, rel: r } : rest;
    }),
  };
}

export function computeStats(nodes: TechNode[], research: ResearchItem[], roots: string[]): AtlasStats {
  const depthHist: Record<string, number> = {};
  const contentStatus: Record<string, number> = {};
  const statusHist: Record<string, number> = {};
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    inc(depthHist, String(n.depth));
    inc(contentStatus, n.content);
    inc(statusHist, n.status);
  }
  const researchByYear: Record<string, number> = {};
  const researchByPubType: Record<string, number> = {};
  const peer = { yes: 0, no: 0, unknown: 0 };
  const resPerDisc: Record<string, number> = {};
  for (const r of research) {
    inc(researchByYear, r.year ? String(r.year) : "tarihsiz");
    inc(researchByPubType, r.pubType ?? "belirtilmemiş");
    if (r.peer === true) peer.yes++;
    else if (r.peer === false) peer.no++;
    else peer.unknown++;
    inc(resPerDisc, byId.get(r.tech)!.disc);
  }
  return {
    disciplines: roots.length,
    nodes: nodes.length,
    leaves: nodes.filter((n) => n.children.length === 0).length,
    maxDepth: Math.max(...nodes.map((n) => n.depth)),
    relations: nodes.reduce((s, n) => s + REL_KINDS.reduce((a, k) => a + n.rel[k].length, 0), 0),
    research: research.length,
    depthHist,
    contentStatus,
    statusHist,
    perDiscipline: roots.map((id) => ({ id, nodes: byId.get(id)!.desc + 1, research: resPerDisc[id] ?? 0 })),
    researchByYear,
    researchByPubType,
    peerReviewed: peer,
    nodesWithResearch: nodes.filter((n) => n.res > 0).length,
  };
}
