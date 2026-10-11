// Rescores every account and writes scores back, without fetching news.  npm run rescore
import { rescoreAll } from "../lib/rescore";
const scores = await rescoreAll(new Set());
console.log(`Rescored ${scores.length} accounts.`);
