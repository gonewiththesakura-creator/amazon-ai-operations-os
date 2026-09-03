import type { Metadata } from "next";
import "../styles/tokens.css";
import "./globals.css";
import "../styles/shell.css";
import "../styles/navigation.css";
import "../styles/composer.css";
import "../styles/inspector.css";
import "../styles/components.css";
import "../styles/domains.css";
import "../styles/charts.css";
import "../styles/responsive.css";

export const metadata: Metadata = {
  title: "Amazon AI Operations OS | Jarvis",
  description: "AI-native Amazon operations workspace with traceable synthetic evidence"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <template
          dangerouslySetInnerHTML={{
            __html: "<!-- THESIS: Jarvis presents a finished executive judgment, not an AI dashboard. OWN-WORLD: warm ivory paper, ink typography, moss commands, champagne numbering, and architectural hairlines. STORY: understand what changed, review the ranked response, then inspect evidence. FIRST VIEWPORT: a quiet editorial judgment, a typographic metric strip, and ranked actions above the persistent paper command bar. FORM: Executive Architecture Folio, grounded direction 4, seed f46862fe. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. -->",
          }}
        />
        <span
          hidden
          data-direction-contract="m1-6-zen-executive-f46862fe"
          data-information-contract="m1-7-progressive-disclosure"
          data-thesis="A completed executive judgment replaces the AI dashboard."
          data-own-world="Warm ivory paper, editorial Chinese serif, ink, moss, champagne numbering, architectural hairlines."
          data-first-viewport="Quiet judgment, typographic metrics, ranked actions, persistent paper composer, warm inspector."
          data-finish="unreviewed and undocumented is unfinished"
        />
        {children}
      </body>
    </html>
  );
}
