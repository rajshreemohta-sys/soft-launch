import { XMLParser } from "fast-xml-parser";

// Google News RSS search, restricted to India and the last N days. Free, no key.

export type Article = {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO
  snippet: string;
};

// Two queries per company, each pairing the company's search terms with trigger keywords
// from the taxonomy in CLAUDE.md section 6.
const KEYWORD_GROUPS = [
  ["hiring", "jobs", "appoints", "appointed", "CHRO", '"HR head"', "COO", "funding", "raises", "IPO"],
  ["expansion", "expands", "opens", '"new plant"', "warehouse", "stores", "attrition", "layoffs", "strike", "workforce", "digital"],
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

// The Ken (the-ken.com) covers Indian startups in depth. Its own RSS feed has only ~10
// items with no teaser, but Google News indexes its full headlines, so we search it there
// by site, without trigger keywords (its headlines are analytical, not keyword-led).
// We read headlines only; we never log in or fetch paywalled article text.
const KEN_SITE = "the-ken.com";

export function buildQueries(searchTerms: string[], days = 7): string[] {
  const names = searchTerms.length === 1 ? searchTerms[0] : `(${searchTerms.join(" OR ")})`;
  return [
    ...KEYWORD_GROUPS.map((kw) => `${names} (${kw.join(" OR ")}) when:${days}d`),
    `site:${KEN_SITE} ${names} when:${days}d`,
  ];
}

export function rssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  source?: string | { "#text"?: string };
};

async function fetchQuery(query: string): Promise<Article[]> {
  const res = await fetch(rssUrl(query), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SignalMonitor/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google News returned ${res.status}`);
  const xml = await res.text();
  const items: RssItem[] = [parser.parse(xml)?.rss?.channel?.item ?? []].flat();

  return items
    .filter((i) => i.link && i.title)
    .map((i) => {
      const source = typeof i.source === "string" ? i.source : i.source?.["#text"] ?? "";
      // Google News titles end with " - Source Name"; drop that suffix.
      const title = source && i.title!.endsWith(` - ${source}`)
        ? i.title!.slice(0, -(source.length + 3))
        : i.title!;
      const published = i.pubDate ? new Date(i.pubDate) : new Date();
      return {
        title: stripHtml(title),
        url: i.link!,
        source,
        publishedAt: published.toISOString(),
        snippet: stripHtml(i.description ?? "").slice(0, 400),
      };
    });
}

// Company names from search terms: the quoted part if any ('"Porter" logistics' -> 'porter').
function companyNames(searchTerms: string[]): string[] {
  return searchTerms.map((t) => (t.match(/"([^"]+)"/)?.[1] ?? t).toLowerCase());
}

// The Ken's newsletters mention big companies in passing, so keep a Ken article
// only when the company is named in its headline.
function isRelevantKen(a: Article, names: string[]): boolean {
  if (a.source !== "The Ken" && !a.url.includes(KEN_SITE)) return true;
  const title = a.title.toLowerCase();
  return names.some((n) => title.includes(n));
}

// Fetch all queries for one company, de-duplicated by URL and title, newest first.
export async function fetchCompanyNews(searchTerms: string[], days = 7): Promise<Article[]> {
  const names = companyNames(searchTerms);
  const results = await Promise.all(buildQueries(searchTerms, days).map(fetchQuery));
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const articles: Article[] = [];
  for (const a of results.flat()) {
    if (!isRelevantKen(a, names)) continue;
    const titleKey = a.title.toLowerCase();
    if (seenUrls.has(a.url) || seenTitles.has(titleKey)) continue;
    seenUrls.add(a.url);
    seenTitles.add(titleKey);
    articles.push(a);
  }
  return articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
