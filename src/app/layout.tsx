import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bilim ve Teknoloji Atlası",
  description:
    "3.492 düğümlük bilim ve teknoloji sınıflandırmasını, ilişkileri ve arşivdeki akademik araştırmaları tek sayfada keşfedin.",
  applicationName: "Bilim ve Teknoloji Atlası",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#141517" },
  ],
};

// Tema, ilk çizimden önce uygulanır (yanıp sönmeyi önler). Tercih yalnızca bu tarayıcıda saklanır.
const themeScript = `(function(){try{var t=localStorage.getItem("atlas-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
