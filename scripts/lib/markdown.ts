import { Marked, type Tokens } from "marked";
import path from "node:path";

export interface LinkContext {
  /** Belgenin bulunduğu klasör (depo köküne göre, "/" ayraçlı). */
  dir: string;
  /** Klasör yolu -> teknoloji kimliği */
  techByDir: Map<string, string>;
  /** Araştırma dosya yolu -> araştırma anahtarı */
  researchByPath: Map<string, string>;
  /** Depodaki diğer dosyalar için temel adres (GitHub). */
  repoBlobBase: string;
}

const ALLOWED_TAG = /^<\/?(sub|sup|br|em|strong|b|i)\s*\/?>$/i;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bilgi tabanı içi göreli bağlantıyı uygulama içi ya da GitHub bağlantısına çevirir. */
export function resolveHref(href: string, ctx: LinkContext): { href: string; tech?: string; research?: string; external: boolean } | null {
  if (/^(https?:)?\/\//i.test(href)) return { href, external: true };
  if (/^mailto:/i.test(href)) return { href, external: true };
  if (href.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null; // javascript:, data: vb.
  const clean = decodeURIComponent(href.split("#")[0]);
  const target = path.posix.normalize(path.posix.join(ctx.dir, clean));
  if (target.startsWith("..")) return null;
  if (target.endsWith("/_index.md") || target === "_index.md") {
    const dir = path.posix.dirname(target);
    const id = ctx.techByDir.get(dir);
    if (id) return { href: `?t=${encodeURIComponent(id)}`, tech: id, external: false };
  }
  const rk = ctx.researchByPath.get(target);
  if (rk) return { href: `?r=${encodeURIComponent(rk)}`, research: rk, external: false };
  return { href: `${ctx.repoBlobBase}/${target.split("/").map(encodeURIComponent).join("/")}`, external: true };
}

export function renderMarkdown(src: string, ctx: LinkContext): string {
  const marked = new Marked({ gfm: true, breaks: false, async: false });
  marked.use({
    renderer: {
      html(token: Tokens.HTML | Tokens.Tag) {
        // Ham HTML yalnızca küçük bir izin listesiyle geçer; gerisi metin olarak gösterilir.
        const t = token.text;
        return t.replace(/<[^>]*>/g, (tag) => (ALLOWED_TAG.test(tag) ? tag.toLowerCase() : escapeHtml(tag)));
      },
      link(token: Tokens.Link) {
        const inner = this.parser.parseInline(token.tokens);
        const r = resolveHref(token.href, ctx);
        if (!r) return inner;
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        if (r.external) {
          return `<a href="${escapeHtml(r.href)}"${title} target="_blank" rel="noopener noreferrer">${inner}</a>`;
        }
        const data = r.tech ? ` data-tech="${escapeHtml(r.tech)}"` : ` data-research="${escapeHtml(r.research!)}"`;
        return `<a href="${escapeHtml(r.href)}"${data}${title}>${inner}</a>`;
      },
      image(token: Tokens.Image) {
        // Harici görseller gömülmez; bağlantı olarak gösterilir.
        const r = resolveHref(token.href, ctx);
        const label = escapeHtml(token.text || token.href);
        return r ? `<a href="${escapeHtml(r.href)}" target="_blank" rel="noopener noreferrer">[görsel: ${label}]</a>` : label;
      },
    },
  });
  return (marked.parse(src) as string).trim();
}
