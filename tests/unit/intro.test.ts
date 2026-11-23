import { describe, expect, it } from "vitest";
import { buildIntro, introInline } from "../../scripts/lib/atlas";
import { parseFrontmatter } from "../../scripts/lib/frontmatter";

const ctx = { dir: "A", techByDir: new Map<string, string>(), researchByPath: new Map<string, string>(), repoBlobBase: "https://github.com/x/y/blob/main" };

const SRC = `---
node: x
intro_status: ai_draft_sourced
written: 2026-11-23
human_verified: false
---

## Öz

Kısa tanım. [1]

## Neden önemli

## Ana kollar

- **Kuram** · Algoritmalar. [1, 2]
- Etiketsiz madde. [2]

## Bugün nerede

## Neler bekleniyor

- Açık problem. [2]

## Kaynaklar

1. A. (2020). Başlık. https://doi.org/10.1/x
2. B. (2021). <script>x</script> Başlık.
`;

describe("tanıtım kartı", () => {
  const intro = buildIntro(parseFrontmatter(SRC), ctx);

  it("blokları ve boş blokları olduğu gibi taşır", () => {
    expect(intro.summary).toContain("Kısa tanım.");
    expect(intro.why).toBeNull();
    expect(intro.today).toEqual([]);
    expect(intro.pastTitle).toBe("Ana kollar");
    expect(intro.past.map((p) => p.label)).toEqual(["Kuram", null]);
    expect(intro.next).toHaveLength(1);
    expect(intro.humanVerified).toBe(false);
  });

  it("kaynak numaralarını üst simge bağlantısına çevirir", () => {
    expect(introInline("Metin. [1, 2]", ctx)).toBe(
      'Metin.<sup class="cite"><a href="#kaynak-1" data-cite="1">1</a>,<a href="#kaynak-2" data-cite="2">2</a></sup>',
    );
  });

  it("kaynak adreslerini bağlar, ham HTML'i kaçırır", () => {
    expect(intro.sources.map((s) => s.n)).toEqual([1, 2]);
    expect(intro.sources[0].html).toContain('href="https://doi.org/10.1/x"');
    expect(intro.sources[1].html).not.toContain("<script>");
  });
});
