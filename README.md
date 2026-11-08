# Bilim ve Teknoloji Atlası

[`ofsng/teknoloji`](https://github.com/ofsng/teknoloji) bilgi tabanındaki teknoloji sınıflandırmasını,
hiyerarşi dışı ilişkileri ve arşivlenmiş akademik araştırmaları tek sayfada keşfetmek için statik web uygulaması.

- Sunucu ve veritabanı yoktur: derleme sırasında bilgi tabanından JSON indeksleri üretilir, çıktı tamamen statiktir.
- Tek doğruluk kaynağı bilgi tabanındaki Markdown dosyalarıdır. Atlas içerikleri yeniden yazmaz, eksik açıklama üretmez;
  bilgi tabanının deposuna ve otomasyonuna hiçbir şey yazmaz.
- Arayüz yalnızca Türkçedir. Teknoloji kimlikleri bilgi tabanının kalıcı, dilden bağımsız `id` alanlarıdır.

## Geliştirme

```bash
npm install
npm run dev          # veri indekslerini üretir, geliştirme sunucusunu açar
npm run build        # veri + statik derleme → out/
npm start            # out/ klasörünü http://127.0.0.1:4173 adresinde sunar
npm test             # birim ve veri bütünlüğü testleri (Vitest)
npm run test:e2e     # derlenmiş çıktı üzerinde uçtan uca testler (Playwright, masaüstü + mobil)
```

### Veri kaynağı

`npm run data` (`scripts/build-data.ts`) bilgi tabanını şu sırayla arar:

1. `KB_DIR` ortam değişkeni,
2. kardeş klasör `../Technology-Knowledge-Base`,
3. `.kb/` — yoksa `https://github.com/ofsng/teknoloji` sığ klonlanır (`KB_REF` ile dal/etiket seçilebilir).

`KB_STRICT=1` verilirse bir uyarı (yinelenen kimlik, kopuk ilişki, klasörle uyuşmayan `parent`) derlemeyi durdurur.

Üretilen dosyalar (`public/data/`, depoya eklenmez):

| Dosya | İçerik |
|---|---|
| `atlas.json` | Tüm düğümler (sıkıştırılmış), araştırma metadata'sı, istatistikler, kaynak sürüm |
| `n/<id>.json` | Düğüm açıklaması: Markdown'dan güvenli HTML'e çevrilmiş bölümler, içerik kaynakları |
| `r/<anahtar>.json` | Araştırma kaydının bölümleri, anahtar sözcükler, lisans ve doğrulama bilgisi |

## Veri modeli

Ayrıştırma bilgi tabanının kendi aracıyla (`tools/kb.py`) birebir aynı kuralları izler; testler sonucu `kb.py`
çıktısıyla karşılaştırır.

- **Hiyerarşi** klasör yapısından gelir (her klasörde bir `_index.md`). Kardeş sırası `kb.py` ile aynıdır.
- **İlişkiler** ön bilgideki `related`, `depends_on`, `applied_in` alanlarıdır. Haritada ve ayrıntı panelinde
  hiyerarşiden ayrı (kesikli kenar, ayrı bölüm) gösterilir; ters yönleri istemcide hesaplanır.
- **Araştırmalar** `Arastirmalar/` klasöründeki dosyalardır; kanonik teknoloji, dosyanın bulunduğu klasördür
  (`primary_technology` ile tutarlılığı test edilir). `related_technologies` ayrıca listelenir.
- **Açıklamalar**: 1–5 ve 8–14 numaralı bölümlerin elle/kaynaklı yazılmış kısmı alınır; `<!-- AUTO ... -->` blokları
  ve “Henüz doldurulmadı” yer tutucuları atlanır. 6 (alt teknolojiler) ve 7 (ilişkiler) veri modelinden çizilir.
- Markdown derleme sırasında HTML'e çevrilir; ham HTML yalnızca küçük bir izin listesiyle (`sub`, `sup`, `br`, …) geçer.
  Bilgi tabanı içi bağlantılar uygulama içi bağlantılara (`?t=<id>`, `?r=<anahtar>`), diğer depo dosyaları GitHub'a yönlenir.

### İçerik işaretleri

| Durum | Arayüzde |
|---|---|
| `content_status: ai_draft_sourced` | “Doğrulanmamış yapay zekâ taslağı” uyarısı; `content_mode: quotes` ise alıntı notu |
| `content_status: scope_note` | Kapsam notunun kaynaklı tanım olmadığı belirtilir |
| `content_status: empty` | Açıklama üretilmez; içerik olmadığı açıkça yazılır |
| Araştırma kayıtları | Otomatik toplandığı, tam metnin incelenmediği ve sayıların yalnızca arşivi temsil ettiği belirtilir |
| `retraction_status: retracted` | Kırmızı “geri çekildi” uyarısı |

## Arayüz

- Masaüstünde üç sütun: gezgin (ağaç, arama, filtre, araştırma listesi) · harita / istatistikler · ayrıntı.
- Mobilde aynı üç bölüm alt sekmelerle; harita sekmesi görünür olunca seçime odaklanır.
- Harita (Cytoscape.js) kademelidir: başlangıçta 30 ana disiplin; düğüme dokununca dal açılır. Aynı anda en fazla
  450 düğüm çizilir, sınır aşılınca odak yolu dışındaki en eski dallar daraltılır. Radyal (özel ağaç yerleşimi) ve
  katmanlı yerleşim, “Tüm ilişkiler” anahtarı, yakınlaştırma/kaydırma (fare, dokunma, klavye: `+ − 0` ve oklar).
- Ağaç sanallaştırılmıştır (3.492 satırın tamamı açıkken de akıcı) ve WAI-ARIA ağaç desenini izler
  (ok tuşları, Home/End, PageUp/PageDown, Enter).
- Paylaşım: `?t=<teknoloji-id>` ya da `?r=<araştırma-anahtarı>`; tarayıcı geri/ileri desteklenir.
- Açık/koyu tema; ilk tercih sistemden alınır, seçim yalnızca tarayıcıda saklanır.

## Yayınlama (Cloudflare Pages)

Pages projesini bu depoya bağlayın:

- Derleme komutu: `npm run build`
- Çıktı klasörü: `out`
- Ortam: `NODE_VERSION=22` (ya da `.node-version` dosyası)

Derleme bilgi tabanını herkese açık depodan klonlar. `public/_headers` önbellek ve güvenlik başlıklarını tanımlar.
Elle yayın için: `npx wrangler pages deploy out`.

Bilgi tabanı her gün güncellenir. `.github/workflows/refresh.yml`, `CF_PAGES_DEPLOY_HOOK` sırrı tanımlıysa her gün
Pages derleme kancasını tetikleyerek atlası yeniden derletir; bilgi tabanı deposunda değişiklik gerekmez.

## Klasörler

```
scripts/build-data.ts      veri indekslerini üretir
scripts/lib/               ön bilgi ayrıştırıcı (kb.py ile eş), Markdown, atlas oluşturucu, kaynak çözümü
scripts/serve.mjs          out/ için yerel statik sunucu
src/lib/                   istemci veri modeli, arama, ağaç, harita modeli, URL
src/components/            arayüz bileşenleri
tests/unit/                Vitest: gerçek bilgi tabanına karşı bütünlük + mantık testleri
tests/e2e/                 Playwright: masaüstü ve mobil uçtan uca
tests/kb_reference.py      kb.py ile referans döküm (çapraz doğrulama)
```
