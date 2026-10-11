// Builds the Hot List.  npm run hotlist             -> sends (unless DRY_RUN=true)
//                       npm run hotlist -- --dry-run -> builds and saves only
import { runHotList } from "../lib/hotlist";
const dryRun = process.argv.includes("--dry-run") ? true : undefined;
const r = await runHotList({ dryRun, log: console.log });
console.log(`\n${r.subject}\n${r.entries.length} entries, ${r.warm.length} still warm. ${r.dryRun ? "DRY RUN (not sent)." : r.emailId ? "Sent." : `Not sent: ${r.sendError}`}`);
console.log("Preview: /hotlist/preview");
