import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { Header } from "@/components/Header";
import { SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: "Watches live news for 40 accounts and ranks who is worth a call this week.",
  // Shared by link only (e.g. with the professor); keep it out of search results.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <body>
        <div className="shell">
          <Header />
          <div className="rule" />
          <main>{children}</main>
          <div className="rule" />
          <footer className="site-footer">
            <span>{SITE.disclaimer}</span>
            <span>News from Google News and The Ken headlines. AI by Gemini Flash.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
