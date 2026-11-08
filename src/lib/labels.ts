import type { RelKind } from "./types";

export const TYPE_LABEL: Record<string, string> = {
  discipline: "Ana disiplin",
  subdiscipline: "Alt disiplin",
  technology: "Teknoloji",
};

export const STATUS_LABEL: Record<string, string> = {
  established: "Yerleşik",
  emerging: "Gelişmekte",
  historical: "Tarihsel",
  theoretical: "Kuramsal",
};

export const CONF_LABEL: Record<string, string> = { high: "yüksek", medium: "orta", low: "düşük" };

export const CONTENT_LABEL: Record<string, string> = {
  empty: "İçerik yok",
  scope_note: "Kapsam notu",
  manual: "Elle yazılmış",
  ai_draft_sourced: "Yapay zekâ taslağı (kaynaklı, doğrulanmamış)",
  human_verified: "İnsan tarafından doğrulanmış",
};

/** Giden ilişki etiketleri (bu düğüm → hedef) */
export const REL_OUT_LABEL: Record<RelKind, string> = {
  related: "İlişkili",
  depends_on: "Bağımlı olduğu",
  applied_in: "Kullanıldığı alanlar",
};

/** Gelen ilişki etiketleri (kaynak → bu düğüm) */
export const REL_IN_LABEL: Record<RelKind, string> = {
  related: "İlişkili olarak gösteren",
  depends_on: "Buna bağımlı olanlar",
  applied_in: "Bu alanda kullanılanlar",
};

export const PUBTYPE_LABEL: Record<string, string> = {
  article: "Makale",
  preprint: "Ön baskı",
  review: "Derleme",
  "belirtilmemiş": "Belirtilmemiş",
};

export const LICENSE_NOTE = "Özetler yalnızca yeniden yayım lisansı uygun olduğunda arşive kopyalanır.";

export function peerLabel(peer: boolean | null): string {
  return peer === true ? "Hakemli" : peer === false ? "Ön baskı / hakemsiz" : "Hakem durumu bilinmiyor";
}

export function authorsShort(authors: string[]): string {
  if (!authors.length) return "Yazar belirtilmemiş";
  const last = (a: string) => a.trim().split(/\s+/).pop() ?? a;
  return authors.length > 1 ? `${last(authors[0])} vd.` : last(authors[0]);
}

export const fmt = new Intl.NumberFormat("tr-TR");

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
