// ============================================================
// archaiology.org — Edge Function: fetch-gdelt (v3)
// 2 queries, 4s gap, 7d window, retry logic
// Deploy: supabase functions deploy fetch-gdelt
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("https://ucsgtbpeuqeamuvuvojs.supabase.co")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2d0YnBldXFlYW11dnV2b2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzI1ODgsImV4cCI6MjA4OTU0ODU4OH0.X6xIwg0CD6jPY8OQBCL6PejepmUeztUZQwolrfCmHXA")!;
const GDELT_BASE        = "https://api.gdeltproject.org/api/v2/doc/doc";

const QUERIES = [
  {
    q:      "archaeology excavation ancient tomb ruins artifact",
    region: "general",
    tags:   ["archaeology", "excavation"],
  },
  {
    q:      "lidar ancient site burial mound prehistoric fossil inscription",
    region: "general",
    tags:   ["methods", "discovery"],
  },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function classifyRegion(text: string): string {
  const t = text.toLowerCase();
  if (/maya|aztec|olmec|inca|teotihuacan|mesoamerica|copan|tikal/.test(t))       return "mesoamerica";
  if (/mississippian|hopewell|cahokia|pueblo|anasazi|north america/.test(t))     return "north_america";
  if (/minoan|mycenaean|greek|roman|pompeii|etruscan|celtic/.test(t))            return "europe";
  if (/mesopotamia|sumer|babylon|assyria|hittite|anatolia|levant|egypt/.test(t)) return "near_east";
  return "general";
}

function scoreRelevance(title: string): number {
  const t = title.toLowerCase();
  let score = 0.4;
  if (/excavat|unearth|discover|found/.test(t))   score += 0.15;
  if (/archaeolog/.test(t))                        score += 0.15;
  if (/ancient|prehistoric|bronze age/.test(t))    score += 0.10;
  if (/new find|first known|oldest/.test(t))       score += 0.15;
  if (/lidar|satellite|remote sensing/.test(t))    score += 0.10;
  if (/artifact|pottery|inscription|tomb/.test(t)) score += 0.08;
  return Math.min(score, 1.0);
}

async function gdeltFetch(q: string, attempt = 1): Promise<any[]> {
  const params = new URLSearchParams({
    query:      q,
    mode:       "ArtList",
    maxrecords: "25",
    sort:       "DateDesc",
    format:     "json",
    timespan:   "7d",
  });

  const res = await fetch(`${GDELT_BASE}?${params}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 429 || res.status >= 500) {
    if (attempt < 3) {
      await sleep(attempt * 5000);
      return gdeltFetch(q, attempt + 1);
    }
    throw new Error(`GDELT HTTP ${res.status} after ${attempt} attempts`);
  }

  if (!res.ok) throw new Error(`GDELT HTTP ${res.status}`);

  const text = await res.text();
  if (!text.trim().startsWith("{")) {
    throw new Error(`GDELT returned non-JSON (${text.slice(0, 60)})`);
  }

  const data = JSON.parse(text);
  return data?.articles ?? [];
}

Deno.serve(async (_req) => {
  const start    = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let totalFound = 0, totalNew = 0;
  const errors: string[] = [];
  const rows: any[] = [];

  for (let qi = 0; qi < QUERIES.length; qi++) {
    const query = QUERIES[qi];
    if (qi > 0) await sleep(4000);

    try {
      const articles = await gdeltFetch(query.q);
      totalFound += articles.length;

      for (const a of articles) {
        if (!a.url || !a.title) continue;

        let published_at: string | null = null;
        if (a.seendate) {
          const m = a.seendate.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
          if (m) published_at = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).toISOString();
        }

        rows.push({
          source:          "gdelt",
          source_id:       a.url,
          source_url:      a.url,
          title:           a.title.trim(),
          summary:         null,
          publisher:       a.domain ?? null,
          region:          classifyRegion((a.title ?? "") + " " + (a.sourcecountry ?? "")),
          tags:            query.tags,
          content_type:    "news",
          published_at,
          relevance_score: scoreRelevance(a.title ?? ""),
        });
      }
    } catch (err: any) {
      errors.push(`[query ${qi + 1}] ${err.message}`);
    }
  }

  if (rows.length > 0) {
    const { error, count } = await supabase
      .from("archaeology_news")
      .upsert(rows, {
        onConflict:       "source,source_id",
        ignoreDuplicates: true,
        count:            "exact",
      });

    if (error) errors.push(`Supabase upsert: ${error.message}`);
    else totalNew += count ?? 0;
  }

  await supabase.from("news_fetch_log").insert({
    source:      "gdelt",
    items_found: totalFound,
    items_new:   totalNew,
    error:       errors.length > 0 ? errors.join("; ") : null,
    duration_ms: Date.now() - start,
  });

  return new Response(
    JSON.stringify({ ok: true, source: "gdelt", found: totalFound, new: totalNew, errors }),
    { headers: { "Content-Type": "application/json" } }
  );
});
