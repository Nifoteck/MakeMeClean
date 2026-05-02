// Edge Function: postcode-lookup
// Looks up UK addresses for a postcode via getaddress.io (server-side API key).

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function normalizePostcode(input: string) {
  return (input ?? "").trim().toUpperCase();
}

type AddressResult = {
  label: string;
  address: string;
  city?: string | null;
  postcode: string;
};

function formatAddressLines(address: string) {
  const parts = (address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const address1 = parts[0] ?? "";
  const city = parts.length >= 2 ? parts[parts.length - 1] : null;
  const rest = parts.slice(1, -1).join(", ").trim();
  const line = [address1, rest].filter(Boolean).join(", ").trim();
  return { line, city };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const apiKey = Deno.env.get("GETADDRESS_API_KEY");
    if (!apiKey) return json(500, { ok: false, error: "Server misconfiguration" });

    const { postcode } = (await req.json()) as { postcode?: string };
    const normalized = normalizePostcode(postcode ?? "");
    if (!normalized) return json(400, { ok: false, error: "Postcode required" });

    const encoded = encodeURIComponent(normalized);
    const url = `https://api.getaddress.io/find/${encoded}?api-key=${encodeURIComponent(apiKey)}&expand=true`;

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json(400, { ok: false, error: `Lookup failed (${res.status}): ${text || "Invalid postcode"}` });
    }

    const data = await res.json() as {
      postcode?: string;
      addresses?: Array<Record<string, unknown>>;
    };

    const outPostcode = normalizePostcode(data.postcode ?? normalized);
    const addresses = (data.addresses ?? []).map((a: Record<string, unknown>) => {
      const formatted = String(a.formatted_address ?? "");
      const { line, city } = formatAddressLines(formatted);
      const label = formatted || line || outPostcode;
      return { label, address: line || formatted, city, postcode: outPostcode } satisfies AddressResult;
    });

    return json(200, { ok: true, addresses });
  } catch (e) {
    console.error("postcode-lookup error:", e);
    return json(500, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});

