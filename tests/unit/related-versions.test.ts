import { describe, it, expect } from "vitest";
import { relatedVersions, versionHref } from "../../scripts/lib/atlas";
import { parseFrontmatter, list } from "../../scripts/lib/frontmatter";

// Bilgi tabanındaki gerçek related_versions biçimleri (auto/research, 2026-11-15)
const meta = (line: string) => parseFrontmatter(`---\n${line}\n---\n`).meta;

describe("related_versions", () => {
  it("nesne öğeleri yapılandırılmış sürümlere dönüşür, değerler korunur", () => {
    const m = meta(
      'related_versions: [{"relation": "published_version", "doi": "10.1109/tmi.2026.3687158", "journal_ref": "IEEE Transactions on Medical Imaging, vol. 45, no. 7, pp. 3862-3877, 2026", "source": "arxiv"}]',
    );
    expect(relatedVersions(m.related_versions)).toEqual([
      {
        relation: "published_version",
        id: "10.1109/tmi.2026.3687158",
        href: "https://doi.org/10.1109/tmi.2026.3687158",
        journalRef: "IEEE Transactions on Medical Imaging, vol. 45, no. 7, pp. 3862-3877, 2026",
        source: "arxiv",
      },
    ]);
  });

  it("doi alanındaki arXiv kimliği, URL ve sürüm ekli DOI doğru bağlantıyı alır", () => {
    expect(versionHref("2607.10716", false)).toBe("https://arxiv.org/abs/2607.10716");
    expect(versionHref("2411.08961v3", false)).toBe("https://arxiv.org/abs/2411.08961v3");
    expect(versionHref("https://scipost.org/preprints/scipost_202604_00025v2/", false)).toBe("https://scipost.org/preprints/scipost_202604_00025v2/");
    expect(versionHref("10.26434/chemrxiv.15007348/v2", false)).toBe("https://doi.org/10.26434/chemrxiv.15007348/v2");
    expect(versionHref("2611.07363", true)).toBe("https://arxiv.org/abs/2611.07363");
    expect(versionHref("bilinmeyen-kimlik", false)).toBeNull();
  });

  it("arxiv alanlı birleştirme kaydı", () => {
    const m = meta('related_versions: [{"relation": "preprint", "arxiv": "2611.07363", "source": "merge"}]');
    const [v] = relatedVersions(m.related_versions);
    expect(v).toMatchObject({ relation: "preprint", id: "2611.07363", href: "https://arxiv.org/abs/2611.07363", source: "merge" });
  });

  it("boş liste ve düz metin listesi", () => {
    expect(relatedVersions(meta("related_versions: []").related_versions)).toEqual([]);
    expect(relatedVersions(meta('related_versions: ["10.1000/x1"]').related_versions)[0].href).toBe("https://doi.org/10.1000/x1");
  });

  it("list() nesneleri metne çevirmez", () => {
    expect(list(meta('x: ["a", {"b": 1}, 2]').x)).toEqual(["a", "2"]);
  });
});
