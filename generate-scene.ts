// ============================================================
// archaiology.org — Edge Function: generate-scene
// Reads corpus papers for a site → Claude extracts 3D params
// Deploy: supabase functions deploy generate-scene
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY        = Deno.env.get("ANTHROPIC_API_KEY")!;

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let siteId: string | null = null;
  try { const b = await req.json(); siteId = b?.site_id ?? null; } catch {}

  // Get sites that have corpus papers but no reconstruction yet
  let query = supabase
    .from("archaeology_sites")
    .select("id, name, culture, period, region, description")
    .not("id", "in",
      "(SELECT DISTINCT site_id FROM site_reconstructions WHERE site_id IS NOT NULL)"
    )
    .limit(siteId ? 1 : 10);

  if (siteId) query = query.eq("id", siteId);

  const { data: sites, error } = await query;
  if (error) return new Response(JSON.stringify({ ok:false, error: error.message }));

  let processed = 0;
  const results: any[] = [];

  for (const site of (sites ?? [])) {
    // Get corpus papers for this site
    const { data: papers } = await supabase
      .from("archaeology_corpus")
      .select("title, summary")
      .eq("site_id", site.id)
      .not("summary", "is", null)
      .limit(10);

    const paperText = (papers ?? [])
      .map(p => `Title: ${p.title}\nAbstract: ${p.summary}`)
      .join("\n\n---\n\n");

    const prompt = `You are an archaeological reconstruction specialist.
Based on the following papers about ${site.name} (${site.culture ?? ""} culture, ${site.period ?? ""} period), 
extract structured parameters for a Three.js 3D scene reconstruction.

Site description: ${site.description ?? "No description available"}
Culture: ${site.culture ?? "unknown"}
Period: ${site.period ?? "unknown"}
Region: ${site.region ?? "unknown"}

Papers:
${paperText || "No papers with abstracts available — use general knowledge for this culture/period."}

Return ONLY valid JSON with this exact structure:
{
  "site_type": "ceremonial_center|settlement|fortress|palace|temple|burial_site",
  "scale": "small|medium|large",
  "culture": "${(site.culture ?? "maya").toLowerCase()}",
  "period": "${site.period ?? "Classic"}",
  "structures": [
    { "type": "pyramid|platform|plaza|palace|temple|stela|wall|gate|house", 
      "count": 1,
      "height": 4,
      "base": 5,
      "position": "center|north|south|east|west|plaza_edge",
      "notable": ["roof comb", "corbel arch", "hieroglyphic stairway"] }
  ],
  "landscape": "jungle|desert|grassland|mediterranean|temperate",
  "materials": ["limestone", "stucco", "adobe", "marble", "mudbrick"],
  "confidence": 0.8,
  "notes": "brief note on reconstruction basis"
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":         ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system:     "Return only valid JSON. No explanation, no markdown, no backticks.",
          messages:   [{ role: "user", content: prompt }],
        }),
      });

      const data    = await res.json();
      const rawText = data?.content?.[0]?.text?.trim() ?? "{}";
      const clean   = rawText.replace(/```json|```/g, "").trim();
      const sceneJson = JSON.parse(clean);

      const { error: upsertErr } = await supabase
        .from("site_reconstructions")
        .upsert({
          site_id:     site.id,
          culture:     sceneJson.culture ?? site.culture?.toLowerCase(),
          period:      sceneJson.period  ?? site.period,
          scene_json:  sceneJson,
          source_count:(papers ?? []).length,
        }, { onConflict: "site_id" });

      if (upsertErr) results.push({ site: site.name, error: upsertErr.message });
      else           results.push({ site: site.name, ok: true, structures: sceneJson.structures?.length ?? 0 });
      processed++;

    } catch (err: any) {
      results.push({ site: site.name, error: err.message });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});
