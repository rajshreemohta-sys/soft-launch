// Runs the collect pipeline locally (no time limit).
//   npm run collect                       -> all accounts
//   npm run collect -- Zepto "DMart"      -> only these accounts
import { runCollect } from "../lib/collect";

const names = process.argv.slice(2);
const t0 = Date.now();
const summary = await runCollect({
  companyNames: names.length ? names : undefined,
  onAccount: (r) => {
    if ("error" in r) return console.log(`✗ ${r.company}: ${r.error}`);
    console.log(`✓ ${r.company.padEnd(24)} fetched ${String(r.fetched).padStart(3)}  new ${String(r.newArticles).padStart(3)}  events ${String(r.events).padStart(2)}  signals saved ${r.signalsSaved}`);
    for (const s of r.savedSummaries) console.log(`    + ${s}`);
  },
});
console.log(`\nDone in ${Math.round((Date.now() - t0) / 1000)}s: ${summary.processed} accounts, ${summary.signalsFound} new signals, ${summary.errors.length} errors.`);
