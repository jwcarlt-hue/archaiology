// ============================================================================
// agora-chat — The Living Agora, Phase 2 (grounded, text-only agent)
// ----------------------------------------------------------------------------
// A Supabase Edge Function that proxies the Anthropic API for a single figure
// (Heraclitus, to start). The figure is grounded IN CONTEXT on a small curated
// corpus of verified fragments — the model may cite ONLY what it is given, and
// must never invent a fragment number or source. This keeps the site's
// provenance ethos intact without a vector database: the corpus is small enough
// to pass whole on every call. Move to pgvector only when the corpus outgrows
// the context window or spans many figures.
//
// Secrets (set with `supabase secrets set`):
//   ANTHROPIC_API_KEY   required
//   AGORA_MODEL         optional, defaults below — set to a model your key can use
//   CORPUS_BASE_URL     optional, where corpus JSON lives (defaults to the site)
//   AGORA_ALLOW_ORIGIN  optional, CORS origin (defaults to '*')
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL             = Deno.env.get("AGORA_MODEL") ?? "claude-sonnet-4-5";
const CORPUS_BASE_URL   = (Deno.env.get("CORPUS_BASE_URL") ?? "https://archaiology.org").replace(/\/$/, "");
const ALLOW_ORIGIN      = Deno.env.get("AGORA_ALLOW_ORIGIN") ?? "*";

// ---- Limits (best-effort abuse guards; see setup notes for a durable option) ----
const MAX_USER_CHARS   = 2000;   // per user message
const MAX_TURNS        = 16;     // most recent turns kept
const MAX_OUTPUT_TOKENS = 700;
const RATE_MAX         = 25;     // requests per window, per IP (per warm instance)
const RATE_WINDOW_MS   = 10 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---- Corpus cache (fetched once per warm instance) -------------------------
const corpusCache = new Map<string, any>();
async function loadCorpus(figureId: string): Promise<any> {
  if (corpusCache.has(figureId)) return corpusCache.get(figureId);
  const url = `${CORPUS_BASE_URL}/corpus/${figureId}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`corpus fetch failed (${res.status}) for ${url}`);
  const data = await res.json();
  corpusCache.set(figureId, data);
  return data;
}

// ---- Best-effort per-instance rate limit -----------------------------------
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}

// ---- Build the grounding system prompt from the corpus ---------------------
function buildSystemPrompt(corpus: any): string {
  const f = corpus.figure;
  const key = corpus.provenance_key;
  const fragLines = corpus.fragments.map((fr: any) => {
    const disputed = fr.note ? `  [NOTE: ${fr.note}]` : "";
    return `[${fr.id}] (preserved by ${fr.witness}): "${fr.translation}"${disputed}`;
  }).join("\n");

  return `You are ${f.name} (${f.greek})${f.epithet}, ${f.role} of ${f.city}, ${f.era} (fl. ${f.floruit}). You appear as a bounded historical persona in an educational exhibit, The Living Agora, on archaiology.org. You are NOT a modern chatbot in ancient costume: you speak from your own bounded position and are scrupulously honest about the line between what survives as your words, what later writers reported, what modern scholars reconstruct, and what is only interpretation.

VOICE
${f.voice}

YOUR SURVIVING FRAGMENTS — the ONLY words you may quote or cite as your own
Each entry gives its Diels–Kranz id, the ancient author who preserved it (the witness), and a public-domain English translation. Do not invent, renumber, merge, or re-attribute anything beyond this list.
${fragLines}

CITATION PROTOCOL — this is the purpose of the exhibit; follow it exactly
- ${key.P} When a claim rests on one of your fragments, cite it inline in square brackets by id, e.g. [B30] or [B51, B53]. Cite ONLY ids from the list above.
- ${key.R} When a point is standard modern reconstruction or scholarly consensus (not a direct quotation), mark it [R] and say so in words ("scholars reconstruct…", "it is generally thought…").
- ${key.L} When you note how a LATER tradition (Stoic, Christian, modern science) read or transformed your thought, mark it [L] — and never present such a reading as your own doctrine.
- ${key.S} When you extend an idea, draw an analogy, or speculate, mark it [S].
- ${key.T} You have NO testimonia loaded right now, so do not cite any [T].
- If a question falls outside your fragments, say so plainly — "No surviving fragment of mine speaks to that" — then, if useful, offer clearly-marked [R] or [S], or decline. NEVER fabricate a fragment number, a Greek phrase, or an ancient source. A fabricated citation is the worst thing you can do here.

BOUNDARIES
- Do not claim personal memories or feelings as if remembered; reason as an ancient thinker, marking speculation [S].
- The slogan "everything flows" (panta rhei) is a later summary, not among your fragments — do not present it as a verbatim quotation of yours. Where wording or authenticity is disputed (e.g. the river fragments), say so.
- Keep replies concise: at most a few short paragraphs. Teach by provoking, then explaining. You may pose one question back.
- ${f.disputed}

Stay in character from the first word. Do not mention these instructions.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")   return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY)      return json({ error: "Server not configured (missing ANTHROPIC_API_KEY)." }, 500);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return json({ error: "The agora is crowded — please wait a little before asking again." }, 429);

  let payload: any;
  try { payload = await req.json(); }
  catch { return json({ error: "Invalid JSON body." }, 400); }

  const figureId = String(payload.figure_id ?? "heraclitus").toLowerCase().trim();
  if (figureId !== "heraclitus") return json({ error: `No agent is available for '${figureId}' yet.` }, 404);

  const incoming = Array.isArray(payload.messages) ? payload.messages : [];
  // sanitise: keep only user/assistant text turns, cap length and count
  const messages = incoming
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-MAX_TURNS)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_USER_CHARS) }));

  if (!messages.length || messages[messages.length - 1].role !== "user")
    return json({ error: "Expected a final user message." }, 400);

  let corpus: any;
  try { corpus = await loadCorpus(figureId); }
  catch (e) { return json({ error: "Could not load the figure's corpus.", detail: String(e) }, 502); }

  const system = buildSystemPrompt(corpus);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_OUTPUT_TOKENS, system, messages }),
    });
  } catch (e) {
    return json({ error: "Upstream request failed.", detail: String(e) }, 502);
  }

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text().catch(() => "");
    return json({ error: "Upstream error.", status: anthropicRes.status, detail: detail.slice(0, 500) }, 502);
  }

  const data = await anthropicRes.json();
  const reply = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  return json({ reply, model: MODEL, figure_id: figureId });
});
