// tools/kb.py içindeki parse_frontmatter'ın birebir karşılığı. Bilgi tabanı kendi
// basit YAML alt kümesini kullanır; genel bir YAML ayrıştırıcısı aynı sonucu vermez.

export type Scalar = string | number | boolean | null;
export type MetaValue = Scalar | Scalar[];
export type Meta = Record<string, MetaValue>;

function parseList(val: string): Scalar[] {
  try {
    const v = JSON.parse(val);
    if (Array.isArray(v)) return v;
  } catch {
    /* kb.py ile aynı geri dönüş */
  }
  return val
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^["']+|["']+$/g, ""));
}

export function parseFrontmatter(text: string): { meta: Meta; body: string } {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: text };
  const meta: Meta = {};
  const raw = text.slice(3, end).replace(/^\n+|\n+$/g, "");
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#") || !line.includes(":")) continue;
    const i = line.indexOf(":");
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.includes(" #") && !val.startsWith('"') && !val.startsWith("[")) {
      val = val.split(" #")[0].trim();
    }
    let out: MetaValue;
    if (val.startsWith("[")) out = parseList(val);
    else if (val.startsWith('"')) {
      try {
        out = JSON.parse(val);
      } catch {
        out = val.replace(/^"+|"+$/g, "");
      }
    } else if (val === "" || val === "null" || val === "~") out = null;
    else if (val === "true" || val === "false") out = val === "true";
    else if (/^-?\d+$/.test(val)) out = parseInt(val, 10);
    else out = val;
    meta[key] = out;
  }
  const body = text.slice(end + 4).replace(/^\n+/, "");
  return { meta, body };
}

export function str(v: MetaValue | undefined): string | null {
  if (v === null || v === undefined || Array.isArray(v)) return null;
  return String(v);
}

export function list(v: MetaValue | undefined): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x !== null && x !== "").map(String);
}

const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O",
  ş: "s", Ş: "S", ü: "u", Ü: "U", â: "a", Â: "A", î: "i", û: "u",
};

export function asciiSlug(text: string): string {
  let t = text.replace(/[çÇğĞıİöÖşŞüÜâÂîû]/g, (c) => TR_MAP[c]);
  t = t.normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
  t = t.replace(/&/g, "ve").replace(/\+/g, "-");
  t = t.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return t.replace(/-{2,}/g, "-");
}

/** kb.py norm_title: kardeş düğümlerin sıralama anahtarı. */
export function normTitle(text: string): string {
  return asciiSlug(text).toLowerCase().replace(/[^a-z0-9]+/g, "");
}
