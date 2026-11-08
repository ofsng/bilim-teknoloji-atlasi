import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { renderMarkdown, resolveHref, type LinkContext } from "../../scripts/lib/markdown";
import { parseFrontmatter } from "../../scripts/lib/frontmatter";
import { isPlaceholder, splitSections, stripAutoBlocks } from "../../scripts/lib/atlas";
import { resolveKb } from "../../scripts/lib/source";
import path from "node:path";

const ctx: LinkContext = {
  dir: "Kuantum/Hesaplama/QEC",
  techByDir: new Map([
    ["Kuantum/Hesaplama", "quantum-computing"],
    ["Matematik/Kodlama", "coding-theory"],
  ]),
  researchByPath: new Map([["Kuantum/Hesaplama/QEC/Arastirmalar/1996-Bennett.md", "abc123"]]),
  repoBlobBase: "https://github.com/ofsng/teknoloji/blob/main",
};

describe("Markdown dönüştürme", () => {
  it("bilgi tabanı içi bağlantıları uygulama içi bağlantılara çevirir", () => {
    const html = renderMarkdown("[Üst](../_index.md), [Kod](../../../Matematik/Kodlama/_index.md), [Makale](Arastirmalar/1996-Bennett.md)", ctx);
    expect(html).toContain('href="?t=quantum-computing" data-tech="quantum-computing"');
    expect(html).toContain('href="?t=coding-theory" data-tech="coding-theory"');
    expect(html).toContain('href="?r=abc123" data-research="abc123"');
  });

  it("bilinmeyen depo dosyalarını GitHub'a, harici bağlantıları yeni sekmeye yönlendirir", () => {
    const html = renderMarkdown("[Liste](../../../TECHNOLOGIES.md) https://doi.org/10.1103/physreva.54.3824", ctx);
    expect(html).toContain('href="https://github.com/ofsng/teknoloji/blob/main/TECHNOLOGIES.md"');
    expect(html).toContain('href="https://doi.org/10.1103/physreva.54.3824" target="_blank" rel="noopener noreferrer"');
  });

  it("ham HTML'i kaçışlar, yalnızca izinli etiketleri bırakır, tehlikeli şemaları atar", () => {
    const html = renderMarkdown('<script>alert(1)</script> <sub>not</sub> <img src=x onerror=alert(1)> [x](javascript:alert(1))', ctx);
    expect(html).not.toMatch(/<script|<img|href="javascript/i);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<sub>not</sub>");
    expect(resolveHref("data:text/html,hi", ctx)).toBeNull();
    expect(resolveHref("../../../../../etc/passwd", ctx)).toBeNull();
  });

  it("listeleri, alıntıları ve vurguları korur", () => {
    const html = renderMarkdown("- “Alıntı.” [1]\n- **Kapsam notu** metin\n\n> özet", ctx);
    expect(html).toContain("<li>“Alıntı.” [1]</li>");
    expect(html).toContain("<strong>Kapsam notu</strong>");
    expect(html).toContain("<blockquote>");
  });
});

describe("_index.md bölüm ayrıştırma", () => {
  const body = `# Başlık

<!-- AUTO:NAV:BEGIN (otomatik; elle düzenlemeyin) -->
**Konum:** x
<!-- AUTO:NAV:END -->

## 1. Tanım

Gerçek tanım.

## 2. Çalışma prensibi

_Henüz doldurulmadı. Yalnızca doğrulanabilir kaynaklara dayanan bilgi ekleyin._

<!-- AUTO:BEGIN (kb.py reindex üretir; bu bloğu elle düzenlemeyin) -->
## 6. Alt teknolojiler

- [A](A/_index.md)

## 7. İlişkili teknolojiler

- y
<!-- AUTO:END -->

## 12. Önemli araştırmalar

Elle yazılmış not.

<!-- AUTO:RESEARCH:BEGIN (otomatik; elle düzenlemeyin) -->
- otomatik liste
<!-- AUTO:RESEARCH:END -->
`;
  it("otomatik blokları atar, elle yazılmış metni korur, yer tutucuları boş sayar", () => {
    const secs = splitSections(stripAutoBlocks(body));
    expect(secs.map((s) => s.n)).toEqual([1, 2, 12]);
    expect(secs[0].content).toBe("Gerçek tanım.");
    expect(isPlaceholder(secs[1].content)).toBe(true);
    expect(secs[2].content).toBe("Elle yazılmış not.");
    expect(isPlaceholder("_Tam metin incelenmedi; bu bölüm yalnızca doğrulanabilir kaynakla doldurulabilir._")).toBe(true);
  });
});

describe("ön bilgi ayrıştırıcı kb.py ile aynı sonucu verir", () => {
  const sample = `---
id: zero-knowledge-proofs   # yorum
title: "Zero-Knowledge Proofs"
aliases: ["ZKP", "Sıfır \\"bilgi\\""]
related: [a, 'b']
year: 2016
peer_reviewed: true
arxiv:
nothing: null
url: https://example.org/a#b
neg: -3
---
gövde`;
  it("örnek ön bilgi", () => {
    const { meta, body } = parseFrontmatter(sample);
    expect(body).toBe("gövde");
    let py: unknown = null;
    try {
      const kbTools = path.join(resolveKb(), "tools");
      py = JSON.parse(
        execFileSync("python3", ["-c", `import sys,json; sys.path.insert(0, ${JSON.stringify(kbTools)}); import kb; print(json.dumps(kb.parse_frontmatter(sys.stdin.read())[0], ensure_ascii=False))`], {
          input: sample,
          encoding: "utf8",
        }),
      );
    } catch {
      /* python3 yoksa yalnızca beklenen değerler denetlenir */
    }
    const expected = {
      id: "zero-knowledge-proofs",
      title: "Zero-Knowledge Proofs",
      aliases: ["ZKP", 'Sıfır "bilgi"'],
      related: ["a", "b"],
      year: 2016,
      peer_reviewed: true,
      arxiv: null,
      nothing: null,
      url: "https://example.org/a#b",
      neg: -3,
    };
    expect(meta).toEqual(expected);
    if (py) expect(meta).toEqual(py);
  });
});
