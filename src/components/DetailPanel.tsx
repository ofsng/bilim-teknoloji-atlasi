"use client";

import { useEffect, useRef, useState } from "react";
import type { AtlasIndex } from "@/lib/atlas";
import { ancestors, descendantResearch, loadNodeDetail, loadResearchDetail } from "@/lib/atlas";
import type { NodeDetail, ResearchDetail, ResearchItem, TechNode } from "@/lib/types";
import { REL_KINDS } from "@/lib/types";
import {
  TYPE_LABEL, STATUS_LABEL, CONF_LABEL, REL_OUT_LABEL, REL_IN_LABEL, PUBTYPE_LABEL, LICENSE_NOTE,
  fmt, authorsShort, peerLabel, formatDate,
} from "@/lib/labels";
import { shareUrl } from "@/lib/url";
import type { Selection } from "./AtlasApp";

interface Props {
  index: AtlasIndex;
  selection: Selection;
  onSelect: (id: string) => void;
  onSelectResearch: (key: string) => void;
  onBack: () => void;
  onFocus: (id: string) => void;
  onShowStats: () => void;
}

export default function DetailPanel(p: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [p.selection.tech, p.selection.research]);

  // Markdown içindeki uygulama içi bağlantıları yakala.
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const tech = a.getAttribute("data-tech");
    const research = a.getAttribute("data-research");
    if (tech && p.index.byId.has(tech)) {
      e.preventDefault();
      p.onSelect(tech);
    } else if (research && p.index.researchByKey.has(research)) {
      e.preventDefault();
      p.onSelectResearch(research);
    }
  };

  const { tech, research } = p.selection;
  return (
    <div ref={scroller} onClick={onClick} className="min-h-0 flex-1 overflow-y-auto">
      {research ? (
        <ResearchView key={research} {...p} item={p.index.researchByKey.get(research)!} />
      ) : tech ? (
        <TechView key={tech} {...p} node={p.index.byId.get(tech)!} />
      ) : (
        <Overview {...p} />
      )}
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Bağlantıyı kopyalayın:", text);
    }
  };
  return { copied, copy };
}

function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger"; children: React.ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-warn-line bg-warn-bg text-warn-fg"
      : tone === "danger"
        ? "border-danger-fg/40 bg-danger-bg text-danger-fg"
        : "border-line bg-subtle text-muted";
  return <div role="note" className={`rounded border px-3 py-2 text-sm leading-snug ${cls}`}>{children}</div>;
}

function H3({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h3 id={id} className="mb-2 mt-6 border-b border-line pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{children}</h3>;
}

function TechLink({ index, id, onSelect, showPath = false }: { index: AtlasIndex; id: string; onSelect: (id: string) => void; showPath?: boolean }) {
  const n = index.byId.get(id)!;
  const disc = index.byId.get(n.disc)!;
  return (
    <a
      href={`?t=${encodeURIComponent(id)}`}
      data-tech={id}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect(id);
      }}
      className="text-accent underline decoration-1 underline-offset-2"
    >
      {n.tr}
      {showPath && n.disc !== id && <span className="text-xs text-faint no-underline"> ({disc.tr})</span>}
    </a>
  );
}

function ResearchRow({ index, r, onSelect, showTech }: { index: AtlasIndex; r: ResearchItem; onSelect: (k: string) => void; showTech?: boolean }) {
  return (
    <li className="py-1.5">
      <a
        href={`?r=${r.key}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          e.stopPropagation();
          onSelect(r.key);
        }}
        className="text-sm text-fg hover:text-accent hover:underline"
      >
        {r.retraction === "retracted" && <span className="font-semibold text-danger-fg">GERİ ÇEKİLDİ · </span>}
        {r.title}
      </a>
      <div className="text-xs text-muted">
        {authorsShort(r.authors)} ({r.year ?? "tarihsiz"})
        {r.publication && <> · <i>{r.publication}</i></>} · {peerLabel(r.peer)}
        {r.cited ? <> · atıf: {fmt.format(r.cited)}</> : null}
        {showTech && <> · {index.byId.get(r.tech)?.tr}</>}
      </div>
    </li>
  );
}

function ContentNotice({ node, detail }: { node: TechNode; detail: NodeDetail | null }) {
  if (node.content === "ai_draft_sourced") {
    return (
      <Notice tone="warn">
        <strong className="font-semibold">Doğrulanmamış yapay zekâ taslağı.</strong> Bu açıklama, bilgi tabanının bakım aracıyla
        (yerel dil modeli) kaynak özetlerinden derlendi ve henüz insan tarafından doğrulanmadı. Köşeli parantezdeki numaralar
        “Kaynaklar” bölümündeki kayıtları gösterir; ifadeleri kaynağından kontrol edin.
        {detail?.contentMode === "quotes" && " Bazı bölümler yalnızca kaynaklardan birebir alıntılardan oluşur."}
      </Notice>
    );
  }
  if (node.content === "scope_note") {
    return <Notice>Bu düğümde yalnızca bir <strong className="font-semibold">kapsam notu</strong> var: sınıflandırma kararını açıklar, kaynaklı bir tanım değildir.</Notice>;
  }
  if (node.content === "empty") {
    return <Notice>Bu teknoloji için bilgi tabanında henüz kaynaklı açıklama yok. Atlas eksik içerik için açıklama üretmez; aşağıdaki bilgiler sınıflandırma ve arşiv verisinden gelir.</Notice>;
  }
  if (!node.verified) {
    return <Notice>Bu içerik henüz insan tarafından doğrulanmış olarak işaretlenmedi.</Notice>;
  }
  return null;
}

function TechView({ index, node, onSelect, onSelectResearch, onFocus }: Props & { node: TechNode }) {
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [err, setErr] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const { copied, copy } = useCopy();
  useEffect(() => {
    let live = true;
    loadNodeDetail(node.id).then((d) => live && setDetail(d), () => live && setErr(true));
    return () => {
      live = false;
    };
  }, [node.id]);

  const path = ancestors(index, node.id);
  const own = index.researchByTech.get(node.id) ?? [];
  const mentioning = index.researchMentioning.get(node.id) ?? [];
  const sub = showSub ? descendantResearch(index, node.id) : [];
  const incoming = index.incoming.get(node.id) ?? [];
  const hasRel = REL_KINDS.some((k) => node.rel[k].length) || incoming.length > 0;
  const src = `https://github.com/${index.atlas.source.repo}/blob/${index.atlas.source.commit ?? "main"}/${(detail?.path ?? "").split("/").map(encodeURIComponent).join("/")}/_index.md`;

  return (
    <article aria-labelledby="dt-title" className="px-4 pb-10 pt-4 sm:px-5">
      <nav aria-label="Konum" className="text-xs text-muted">
        <ol className="flex flex-wrap gap-x-1">
          {path.map((a) => (
            <li key={a} className="after:ml-1 after:text-faint after:content-['›']">
              <TechLink index={index} id={a} onSelect={onSelect} />
            </li>
          ))}
          <li aria-current="page" className="text-faint">{node.tr}</li>
        </ol>
      </nav>
      <h2 id="dt-title" className="mt-2 font-serif text-2xl leading-tight">{node.tr}</h2>
      {node.en && node.en !== node.tr && <p className="mt-0.5 text-sm text-muted" lang="en">{node.en}</p>}
      {node.aliases.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          Diğer adlar: <span lang="en">{node.aliases.join(", ")}</span>
        </p>
      )}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-faint">Tür</dt>
        <dd>{TYPE_LABEL[node.type] ?? node.type} · seviye {node.depth}</dd>
        <dt className="text-faint">Durum</dt>
        <dd>{STATUS_LABEL[node.status] ?? node.status}</dd>
        <dt className="text-faint">Sınıflandırma güveni</dt>
        <dd>{CONF_LABEL[node.conf] ?? node.conf}{node.conf !== "high" && " — konum konusunda kaynaklar arası uzlaşı zayıf ya da gruplayıcı düğüm"}</dd>
        <dt className="text-faint">Alt ağaç</dt>
        <dd>{fmt.format(node.children.length)} doğrudan, {fmt.format(node.desc)} toplam alt düğüm</dd>
        <dt className="text-faint">Kimlik</dt>
        <dd><code className="text-[0.7rem]">{node.id}</code></dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button type="button" onClick={() => onFocus(node.id)} className="rounded border border-line px-2.5 py-1 hover:bg-subtle">
          Haritada odaklan
        </button>
        <button
          type="button"
          onClick={() => copy(shareUrl(window.location.origin, window.location.pathname, { tech: node.id, research: null }))}
          className="rounded border border-line px-2.5 py-1 hover:bg-subtle"
        >
          {copied ? "Bağlantı kopyalandı" : "Bağlantıyı kopyala"}
        </button>
        {detail && (
          <a href={src} target="_blank" rel="noopener noreferrer" className="rounded border border-line px-2.5 py-1 hover:bg-subtle">
            Kaynak dosya ↗
          </a>
        )}
      </div>
      <span className="sr-only" aria-live="polite">{copied ? "Bağlantı panoya kopyalandı" : ""}</span>

      <div className="mt-4">
        <ContentNotice node={node} detail={detail} />
      </div>

      {err && <p className="mt-4 text-sm text-danger-fg">Açıklama dosyası yüklenemedi.</p>}
      {!detail && !err && <p className="mt-4 text-sm text-muted">Açıklama yükleniyor…</p>}
      {detail?.sections.map((s) => (
        <section key={s.n} aria-labelledby={`s-${s.n}`}>
          <H3 id={`s-${s.n}`}>{s.title}</H3>
          <div className="prose-kb" dangerouslySetInnerHTML={{ __html: s.html }} />
        </section>
      ))}

      <section aria-labelledby="h-children">
        <H3 id="h-children">Alt teknolojiler ({fmt.format(node.children.length)})</H3>
        {node.children.length ? (
          <ul className="columns-1 gap-4 text-sm sm:columns-2">
            {node.children.map((c) => {
              const cn = index.byId.get(c)!;
              return (
                <li key={c} className="break-inside-avoid py-0.5">
                  <TechLink index={index} id={c} onSelect={onSelect} />
                  {(cn.children.length > 0 || cn.resAll > 0) && (
                    <span className="text-xs text-faint">
                      {" "}
                      {cn.children.length > 0 && `${cn.desc} alt`}
                      {cn.children.length > 0 && cn.resAll > 0 && " · "}
                      {cn.resAll > 0 && `${cn.resAll} araşt.`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Bu düğüm bir yapraktır; alt sınıflandırması yok.</p>
        )}
      </section>

      <section aria-labelledby="h-rel">
        <H3 id="h-rel">Hiyerarşi dışı ilişkiler</H3>
        {hasRel ? (
          <dl className="space-y-2 text-sm">
            {REL_KINDS.filter((k) => node.rel[k].length).map((k) => (
              <div key={k}>
                <dt className="text-xs text-muted">{REL_OUT_LABEL[k]}</dt>
                <dd className="flex flex-wrap gap-x-3">
                  {node.rel[k].map((t) => <TechLink key={t} index={index} id={t} onSelect={onSelect} showPath />)}
                </dd>
              </div>
            ))}
            {REL_KINDS.map((k) => {
              const from = incoming.filter((i) => i.kind === k);
              if (!from.length) return null;
              return (
                <div key={`in-${k}`}>
                  <dt className="text-xs text-muted">{REL_IN_LABEL[k]}</dt>
                  <dd className="flex flex-wrap gap-x-3">
                    {from.map((i) => <TechLink key={i.from} index={index} id={i.from} onSelect={onSelect} showPath />)}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-sm text-muted">Bilgi tabanında bu düğüm için tanımlı ilişki yok.</p>
        )}
        <p className="mt-2 text-xs text-faint">İlişkiler ön bilgideki related, depends_on ve applied_in alanlarından gelir; üst/alt teknoloji hiyerarşisinden ayrıdır.</p>
      </section>

      <section aria-labelledby="h-res">
        <H3 id="h-res">Arşivdeki araştırmalar</H3>
        <p className="text-xs text-muted">
          Bu düğüm: <strong className="font-semibold text-fg">{fmt.format(own.length)}</strong> · alt teknolojiler dahil:{" "}
          <strong className="font-semibold text-fg">{fmt.format(node.resAll)}</strong>. Sayılar yalnızca bu arşive alınmış kayıtları gösterir;
          alandaki toplam literatürü ya da önemi temsil etmez.
        </p>
        {own.length > 0 && (
          <ul className="mt-1 divide-y divide-line">
            {own.map((r) => <ResearchRow key={r.key} index={index} r={r} onSelect={onSelectResearch} />)}
          </ul>
        )}
        {node.resAll > own.length && (
          <div className="mt-2">
            <button type="button" aria-expanded={showSub} onClick={() => setShowSub((v) => !v)} className="text-sm text-accent underline underline-offset-2">
              {showSub ? "Alt teknolojilerdeki kayıtları gizle" : `Alt teknolojilerdeki ${fmt.format(node.resAll - own.length)} kaydı göster`}
            </button>
            {showSub && (
              <ul className="mt-1 divide-y divide-line">
                {sub.map((r) => <ResearchRow key={r.key} index={index} r={r} onSelect={onSelectResearch} showTech />)}
              </ul>
            )}
          </div>
        )}
        {mentioning.length > 0 && (
          <>
            <p className="mt-3 text-xs text-muted">Başka bir teknolojiye ait olup bu düğümü ilişkili teknoloji olarak anan kayıtlar:</p>
            <ul className="mt-1 divide-y divide-line">
              {mentioning.map((r) => <ResearchRow key={r.key} index={index} r={r} onSelect={onSelectResearch} showTech />)}
            </ul>
          </>
        )}
      </section>

      {detail && (detail.classificationRefs.length > 0 || detail.contentSources.length > 0 || detail.emptySections.length > 0) && (
        <section aria-labelledby="h-meta">
          <H3 id="h-meta">Kayıt bilgisi</H3>
          <dl className="space-y-2 text-xs">
            {detail.classificationRefs.length > 0 && (
              <div>
                <dt className="text-muted">Sınıflandırma referansları</dt>
                <dd>{detail.classificationRefs.join(", ")}</dd>
              </div>
            )}
            {detail.contentSources.length > 0 && (
              <div>
                <dt className="text-muted">İçerik kaynakları (DOI)</dt>
                <dd className="flex flex-col">
                  {detail.contentSources.map((s) => (
                    <a key={s} href={/^10\./.test(s) ? `https://doi.org/${s}` : s} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline underline-offset-2">
                      {s}
                    </a>
                  ))}
                </dd>
              </div>
            )}
            {detail.emptySections.length > 0 && (
              <div>
                <dt className="text-muted">Henüz doldurulmamış bölümler</dt>
                <dd className="text-faint">{detail.emptySections.join(", ")}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted">Oluşturulma · son bakım</dt>
              <dd>{formatDate(detail.created)}{detail.lastMaintained && ` · ${formatDate(detail.lastMaintained)}`}</dd>
            </div>
          </dl>
        </section>
      )}
    </article>
  );
}

function ResearchView({ index, item: r, onSelect, onBack }: Props & { item: ResearchItem }) {
  const [detail, setDetail] = useState<ResearchDetail | null>(null);
  const [err, setErr] = useState(false);
  const { copied, copy } = useCopy();
  useEffect(() => {
    let live = true;
    loadResearchDetail(r.key).then((d) => live && setDetail(d), () => live && setErr(true));
    return () => {
      live = false;
    };
  }, [r.key]);
  const tech = index.byId.get(r.tech)!;
  const doiUrl = r.doi ? `https://doi.org/${r.doi}` : null;
  const arxivUrl = r.arxiv ? `https://arxiv.org/abs/${r.arxiv}` : null;
  const src = `https://github.com/${index.atlas.source.repo}/blob/${index.atlas.source.commit ?? "main"}/${r.path.split("/").map(encodeURIComponent).join("/")}`;

  return (
    <article aria-labelledby="rv-title" className="px-4 pb-10 pt-4 sm:px-5">
      <button type="button" onClick={onBack} className="text-sm text-accent underline underline-offset-2">
        ← {tech.tr}
      </button>
      <p className="mt-3 text-xs uppercase tracking-wide text-muted">
        {PUBTYPE_LABEL[r.pubType ?? "belirtilmemiş"] ?? r.pubType} · {peerLabel(r.peer)}
      </p>
      <h2 id="rv-title" className="mt-1 font-serif text-xl leading-snug" lang="en">{r.title}</h2>
      <p className="mt-2 text-sm">
        {r.authors.length ? r.authors.join(", ") : "Yazar belirtilmemiş"}
        {r.authorsTruncated && <span className="text-muted"> ve diğerleri (yazar listesi kaynakta kısaltılmış)</span>}
      </p>
      <p className="mt-1 text-sm text-muted">
        {r.publication && <i>{r.publication}</i>}
        {r.publication && " · "}
        {r.date ? formatDate(r.date) : r.year ?? "tarihsiz"}
      </p>

      {r.retraction === "retracted" && (
        <div className="mt-3"><Notice tone="danger"><strong>Bu çalışma geri çekildi.</strong> Bulgularına dayanmayın.</Notice></div>
      )}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {doiUrl && (<><dt className="text-faint">DOI</dt><dd><a className="break-all text-accent underline underline-offset-2" href={doiUrl} target="_blank" rel="noopener noreferrer">{r.doi}</a></dd></>)}
        {arxivUrl && (<><dt className="text-faint">arXiv</dt><dd><a className="text-accent underline underline-offset-2" href={arxivUrl} target="_blank" rel="noopener noreferrer">{r.arxiv}</a></dd></>)}
        {r.url && r.url !== doiUrl && r.url !== arxivUrl && (<><dt className="text-faint">Bağlantı</dt><dd><a className="break-all text-accent underline underline-offset-2" href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a></dd></>)}
        <dt className="text-faint">Atıf</dt>
        <dd>{r.cited != null ? `${fmt.format(r.cited)} (toplama anındaki metadata kaynağına göre)` : "bilinmiyor"}</dd>
        <dt className="text-faint">Geri çekme</dt>
        <dd>{r.retraction === "none_reported" ? "bildirilmemiş" : r.retraction === "retracted" ? "geri çekildi" : "denetlenmedi / bilinmiyor"}{detail?.retractionChecked && ` (denetim: ${formatDate(detail.retractionChecked)})`}</dd>
        <dt className="text-faint">Kimlik doğrulama</dt>
        <dd>{r.idVerified && r.idVerified !== "false" && r.idVerified !== "not_found" ? r.idVerified : "doğrulanamadı"}</dd>
        <dt className="text-faint">Kayıt kimliği</dt>
        <dd><code className="break-all text-[0.7rem]">{r.rid}</code></dd>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => copy(shareUrl(window.location.origin, window.location.pathname, { tech: null, research: r.key }))}
          className="rounded border border-line px-2.5 py-1 hover:bg-subtle"
        >
          {copied ? "Bağlantı kopyalandı" : "Bağlantıyı kopyala"}
        </button>
        <a href={src} target="_blank" rel="noopener noreferrer" className="rounded border border-line px-2.5 py-1 hover:bg-subtle">Kaynak dosya ↗</a>
      </div>

      <div className="mt-4">
        <Notice>
          Kayıt otomatik toplandı ve sınıflandırıldı ({r.method === "manual" ? "elle" : "deterministik kurallarla"}); içerik insan tarafından doğrulanmadı.
          Tam metin incelenmedi; aşağıda yalnızca kaynakta bulunan ve lisansı izin veren bilgiler yer alır.
        </Notice>
      </div>

      {err && <p className="mt-4 text-sm text-danger-fg">Kayıt dosyası yüklenemedi.</p>}
      {!detail && !err && <p className="mt-4 text-sm text-muted">Kayıt yükleniyor…</p>}
      {detail?.sections.map((s) => (
        <section key={s.n} aria-labelledby={`rs-${s.n}`}>
          <H3 id={`rs-${s.n}`}>{s.title}</H3>
          <div className="prose-kb" lang={s.html.startsWith("<blockquote") ? "en" : undefined} dangerouslySetInnerHTML={{ __html: s.html }} />
        </section>
      ))}

      <section aria-labelledby="rs-tech">
        <H3 id="rs-tech">Teknoloji bağlantısı</H3>
        <dl className="space-y-1 text-sm">
          <div><dt className="inline text-xs text-muted">Kanonik konum: </dt><dd className="inline"><TechLink index={index} id={r.tech} onSelect={onSelect} showPath /></dd></div>
          {r.related.length > 0 && (
            <div>
              <dt className="inline text-xs text-muted">İlişkili teknolojiler: </dt>
              <dd className="inline">{r.related.map((t, i) => <span key={t}>{i > 0 && ", "}<TechLink index={index} id={t} onSelect={onSelect} /></span>)}</dd>
            </div>
          )}
        </dl>
      </section>

      {detail && (
        <section aria-labelledby="rs-meta">
          <H3 id="rs-meta">Kayıt bilgisi</H3>
          <dl className="space-y-2 text-xs">
            {detail.keywords.length > 0 && (<div><dt className="text-muted">Anahtar sözcükler</dt><dd lang="en">{detail.keywords.join(", ")}</dd></div>)}
            <div><dt className="text-muted">Özet lisansı</dt><dd>{detail.abstractLicense ?? "belirtilmemiş — özet kopyalanmadı"}. {LICENSE_NOTE}</dd></div>
            {detail.sourceIds.length > 0 && (<div><dt className="text-muted">Metadata kaynakları</dt><dd className="break-all">{detail.sourceIds.join(", ")}</dd></div>)}
            {detail.relatedVersions.length > 0 && (<div><dt className="text-muted">Diğer sürümler</dt><dd className="break-all">{detail.relatedVersions.join(", ")}</dd></div>)}
            <div><dt className="text-muted">Toplanma · son denetim</dt><dd>{formatDate(detail.collectedAt)} · {formatDate(detail.lastCheckedAt)}</dd></div>
          </dl>
        </section>
      )}
    </article>
  );
}

function Overview({ index, onSelect, onShowStats }: Props) {
  const s = index.atlas.stats;
  const src = index.atlas.source;
  return (
    <article aria-labelledby="ov-title" className="px-4 pb-10 pt-4 sm:px-5">
      <h2 id="ov-title" className="font-serif text-2xl leading-tight">Genel bakış</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Atlas, bilim ve teknoloji alanlarını en genel disiplinlerden özel yöntemlere kadar sınıflandıran açık bilgi tabanının
        etkileşimli görünümüdür. Soldaki ağaçtan, aramadan ya da haritadan bir düğüm seçin.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-xs text-muted">Ana disiplin</dt><dd className="tabular-nums text-lg">{fmt.format(s.disciplines)}</dd></div>
        <div><dt className="text-xs text-muted">Toplam düğüm</dt><dd className="tabular-nums text-lg">{fmt.format(s.nodes)}</dd></div>
        <div><dt className="text-xs text-muted">En derin seviye</dt><dd className="tabular-nums text-lg">{s.maxDepth}</dd></div>
        <div><dt className="text-xs text-muted">Hiyerarşi dışı ilişki</dt><dd className="tabular-nums text-lg">{fmt.format(s.relations)}</dd></div>
        <div><dt className="text-xs text-muted">Arşivdeki araştırma</dt><dd className="tabular-nums text-lg">{fmt.format(s.research)}</dd></div>
        <div><dt className="text-xs text-muted">Araştırması olan düğüm</dt><dd className="tabular-nums text-lg">{fmt.format(s.nodesWithResearch)}</dd></div>
      </dl>
      <button type="button" onClick={onShowStats} className="mt-3 text-sm text-accent underline underline-offset-2">Tüm istatistikler</button>

      <h3 className="mb-2 mt-6 border-b border-line pb-1 text-xs font-semibold uppercase tracking-wide text-muted">Ana disiplinler</h3>
      <ul className="text-sm">
        {index.atlas.roots.map((id) => {
          const n = index.byId.get(id)!;
          return (
            <li key={id} className="flex justify-between gap-3 py-0.5">
              <TechLink index={index} id={id} onSelect={onSelect} />
              <span className="tabular-nums text-xs text-faint">{fmt.format(n.desc + 1)} düğüm{n.resAll ? ` · ${n.resAll} araşt.` : ""}</span>
            </li>
          );
        })}
      </ul>

      <h3 className="mb-2 mt-6 border-b border-line pb-1 text-xs font-semibold uppercase tracking-wide text-muted">Verinin kapsamı</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
        <li>Tek doğruluk kaynağı bilgi tabanındaki Markdown dosyalarıdır; atlas içerikleri yeniden yazmaz, eksik açıklama üretmez.</li>
        <li>
          {fmt.format(s.contentStatus.empty ?? 0)} düğümde henüz kaynaklı açıklama yok. {fmt.format(s.contentStatus.ai_draft_sourced ?? 0)} düğümün açıklaması
          yapay zekâ ile kaynaklardan derlenmiş, doğrulanmamış taslaktır ve öyle işaretlenir.
        </li>
        <li>Araştırma sayıları yalnızca otomatik arşive alınmış kayıtları gösterir; bir alandaki literatürün büyüklüğünü ya da önemini yansıtmaz.</li>
        <li>Hiyerarşi (üst/alt teknoloji) klasör yapısından, ilişkiler ise ön bilgideki ayrı alanlardan gelir ve ayrı gösterilir.</li>
      </ul>
      <p className="mt-4 text-xs text-faint">
        Kaynak:{" "}
        <a className="underline underline-offset-2" href={`https://github.com/${src.repo}`} target="_blank" rel="noopener noreferrer">{src.repo}</a>
        {src.commit && <> · sürüm <code>{src.commit.slice(0, 7)}</code></>}
        {src.commitDate && <> ({formatDate(src.commitDate)})</>} · veri derlemesi {formatDate(index.atlas.generatedAt)}
      </p>
    </article>
  );
}
