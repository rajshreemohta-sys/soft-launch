import "server-only";
import { cacheLife } from "next/cache";
import { fetchCompanyNews, type Article } from "./news";

// Live data for the account page, cached so page views don't hammer the sources.

export type StockSeries = {
  symbol: string;
  currency: string;
  price: number;
  changePct: number; // over the range
  points: { t: number; close: number }[];
};

// Daily closes for the last 6 months from Yahoo Finance (NSE). Null if unavailable.
export async function getStock(nseSymbol: string): Promise<StockSeries | null> {
  "use cache";
  cacheLife("hours");
  if (!/^[A-Z0-9&-]{1,20}$/.test(nseSymbol)) return null;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(nseSymbol)}.NS?range=6mo&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const r = (await res.json())?.chart?.result?.[0];
    const ts: number[] = r?.timestamp ?? [];
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    const points = ts.map((t, i) => ({ t: t * 1000, close: closes[i] })).filter((p): p is { t: number; close: number } => typeof p.close === "number");
    if (points.length < 2) return null;
    const price = r.meta?.regularMarketPrice ?? points.at(-1)!.close;
    return {
      symbol: nseSymbol,
      currency: r.meta?.currency ?? "INR",
      price,
      changePct: ((price - points[0].close) / points[0].close) * 100,
      points,
    };
  } catch {
    return null;
  }
}

// Recent news (14 days) for the account page.
export async function getRecentNews(searchTerms: string[]): Promise<Article[]> {
  "use cache";
  cacheLife("hours");
  try {
    return (await fetchCompanyNews(searchTerms, 14)).slice(0, 8);
  } catch {
    return [];
  }
}
