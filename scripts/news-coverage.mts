// Counts recent Google News articles per company, to spot accounts with too little news.
// Run: npm run news:coverage
import { readFileSync } from "node:fs";
import { fetchCompanyNews } from "../lib/news.ts";

type Seed = { company_name: string; search_terms: string[] };
const accounts: Seed[] = JSON.parse(readFileSync(new URL("../seed/accounts.json", import.meta.url), "utf8"));

const rows: { company: string; d7: number; d30: number; sample: string }[] = [];
for (const a of accounts) {
  try {
    const [d7, d30] = await Promise.all([fetchCompanyNews(a.search_terms, 7), fetchCompanyNews(a.search_terms, 30)]);
    rows.push({ company: a.company_name, d7: d7.length, d30: d30.length, sample: d7[0]?.title ?? d30[0]?.title ?? "" });
  } catch (e) {
    rows.push({ company: a.company_name, d7: -1, d30: -1, sample: `ERROR ${(e as Error).message}` });
  }
  await new Promise((r) => setTimeout(r, 400));
}

rows.sort((a, b) => a.d7 - b.d7 || a.d30 - b.d30);
console.log("company\t7d\t30d\tnewest headline");
for (const r of rows) console.log(`${r.company}\t${r.d7}\t${r.d30}\t${r.sample.slice(0, 90)}`);
