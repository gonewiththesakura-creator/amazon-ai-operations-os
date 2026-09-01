import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amazon AI Operations OS | Jarvis",
  description: "AI-native Amazon operations workspace with traceable synthetic evidence"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <span
          hidden
          data-direction-contract="m1-5-calm-ops-v1"
          data-thesis="AI judgment leads; registered evidence and actions explain it. No KPI wall or blank chat."
          data-own-world="Warm graphite, workhorse sans, restrained emerald, unframed narrative sections, compact evidence overlays."
          data-first-viewport="Navigation, one Jarvis judgment, ranked actions, persistent composer, contextual inspector."
          data-finish="unreviewed and undocumented is unfinished"
        />
        {children}
      </body>
    </html>
  );
}
