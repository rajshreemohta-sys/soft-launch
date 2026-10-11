import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Signal Desk",
  description: "Account signal monitor: which accounts are worth a call this week.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <body>
        {children}
        <footer className="site-footer">
          Demo project. Companies and news are real; Arjun, his product and all
          deal notes are fictional.
        </footer>
      </body>
    </html>
  );
}
