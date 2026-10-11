import { connection } from "next/server";
import { getLatestHotList } from "@/lib/data";

// The latest Hot List email on its own, for opening in a new tab.
export async function GET() {
  await connection();
  const latest = await getLatestHotList();
  if (!latest) return new Response("No Hot List email has been built yet.", { status: 404 });
  return new Response(latest.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The email is static HTML: no scripts may run in it.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:",
    },
  });
}
