// Veri hazırlama betiği (scripts/build-data.ts) ile arayüzün paylaştığı veri sözleşmesi.
// Kimlikler bilgi tabanındaki kalıcı `id` alanlarıdır ve dilden bağımsızdır.

export type NodeType = "discipline" | "subdiscipline" | "technology";
export type RelKind = "related" | "depends_on" | "applied_in";
export const REL_KINDS: RelKind[] = ["related", "depends_on", "applied_in"];

export interface TechNode {
  id: string;
  /** Türkçe ad (title_tr) */
  tr: string;
  /** Özgün teknik ad (title) */
  en: string;
  type: NodeType;
  /** Hiyerarşideki üst düğüm (klasör yapısından); ana disiplinlerde null */
  parent: string | null;
  depth: number;
  /** Bağlı olduğu ana disiplinin kimliği */
  disc: string;
  status: string;
  conf: string;
  aliases: string[];
  /** Hiyerarşiden bağımsız, ön bilgide tanımlı ilişkiler */
  rel: Record<RelKind, string[]>;
  content: string;
  verified: boolean;
  children: string[];
  /** Bu düğümün kendi araştırma sayısı */
  res: number;
  /** Alt teknolojiler dahil araştırma sayısı */
  resAll: number;
  /** Alt ağaçtaki düğüm sayısı (kendisi hariç) */
  desc: number;
  /** Depodaki klasör yolu (yalnızca ayrıntı dosyasında gelir) */
  path?: string;
}

export interface ResearchItem {
  key: string;
  rid: string;
  title: string;
  authors: string[];
  authorsTruncated: boolean;
  year: number | null;
  date: string | null;
  doi: string | null;
  arxiv: string | null;
  url: string | null;
  publication: string | null;
  pubType: string | null;
  peer: boolean | null;
  tech: string;
  related: string[];
  cited: number | null;
  retraction: string | null;
  contentStatus: string | null;
  idVerified: string | null;
  method: string | null;
  path: string;
}

export interface Section {
  n: number;
  title: string;
  html: string;
}

export interface NodeDetail {
  id: string;
  /** Depodaki klasör yolu */
  path: string;
  sections: Section[];
  /** Bölüm başlıkları; içerik yoksa boş */
  emptySections: string[];
  contentSources: string[];
  classificationRefs: string[];
  contentMode: string | null;
  created: string | null;
  lastMaintained: string | null;
}

export interface ResearchDetail {
  key: string;
  sections: Section[];
  keywords: string[];
  abstractLicense: string | null;
  sourceIds: string[];
  relatedVersions: string[];
  collectedAt: string | null;
  lastCheckedAt: string | null;
  retractionChecked: string | null;
}

export interface AtlasStats {
  disciplines: number;
  nodes: number;
  leaves: number;
  maxDepth: number;
  relations: number;
  research: number;
  depthHist: Record<string, number>;
  contentStatus: Record<string, number>;
  statusHist: Record<string, number>;
  perDiscipline: { id: string; nodes: number; research: number }[];
  researchByYear: Record<string, number>;
  researchByPubType: Record<string, number>;
  peerReviewed: { yes: number; no: number; unknown: number };
  nodesWithResearch: number;
}

/** atlas.json içindeki sıkıştırılmış düğüm: çocuklar düğüm sırasından, boş ilişkiler atlanır. */
export type TechNodeWire = Omit<TechNode, "children" | "path" | "rel"> & { rel?: Partial<Record<RelKind, string[]>> };

export interface AtlasWire {
  generatedAt: string;
  source: { repo: string; commit: string | null; commitDate: string | null };
  stats: AtlasStats;
  roots: string[];
  /** Derinlik öncelikli ağaç sırasında; kardeşler bilgi tabanındaki sırayla */
  nodes: TechNodeWire[];
  research: ResearchItem[];
}

export interface Atlas extends Omit<AtlasWire, "nodes"> {
  nodes: TechNode[];
}
