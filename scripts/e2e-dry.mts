// End-to-end dry run: collect all accounts, then build the Hot List without sending email.
//   npm run e2e:dry
import { runCollect } from "../lib/collect";
import { runHotList } from "../lib/hotlist";
const c = await runCollect({ onAccount: (r) => console.log("error" in r ? `✗ ${r.company}: ${r.error}` : `✓ ${r.company}: ${r.signalsSaved} new signals`) });
console.log(`\nCollect: ${c.processed} accounts, ${c.signalsFound} new signals, ${c.errors.length} errors.\n`);
const h = await runHotList({ dryRun: true, log: console.log });
console.log(`\n${h.subject}\nDRY RUN complete. Open /hotlist/preview to see the email.`);
