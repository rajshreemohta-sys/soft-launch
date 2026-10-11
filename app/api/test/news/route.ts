import { fetchCompanyNews, buildQueries } from "@/lib/news";
import { supabaseAdmin } from "@/lib/supabase";

// Phase 3 checkpoint: real recent articles for a few companies, no AI.
// /api/test/news                       -> Zepto, Delhivery, Apollo Hospitals
// /api/test/news?companies=DMart,Porter -> any companies by name

const DEFAULT = ["Zepto", "Delhivery", "Apollo Hospitals"];

export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get("companies");
  const names = (param ? param.split(",") : DEFAULT).map((n) => n.trim()).slice(0, 5);

  const { data: accounts, error } = await supabaseAdmin()
    .from("accounts")
    .select("company_name, search_terms")
    .in("company_name", names);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = await Promise.all(
    (accounts ?? []).map(async (a) => {
      try {
        const articles = await fetchCompanyNews(a.search_terms);
        return { company: a.company_name, queries: buildQueries(a.search_terms), count: articles.length, articles };
      } catch (e) {
        return { company: a.company_name, error: (e as Error).message };
      }
    })
  );

  return Response.json({ fetchedAt: new Date().toISOString(), results });
}
