import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import LangToggle from "./LangToggle";
import ThemeToggle from "./ThemeToggle";
import { getLocale, getStrings } from "@/lib/i18n.server";

// The question is something you read and think about; the machinery around it
// is instrumentation. Two registers, deliberately different.
const display = Newsreader({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-mono", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getStrings();
  return { title: t.title, description: t.description };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored choice before first paint, so a dark-mode user
            never gets a frame of paper white. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.theme;if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="shell">{children}</div>
        {/* Theme renders nothing until it mounts, so it sits first and grows
            leftwards — the language button stays pinned and never jumps. */}
        <div className="toggles">
          <ThemeToggle locale={locale} />
          <LangToggle locale={locale} />
        </div>
      </body>
    </html>
  );
}
