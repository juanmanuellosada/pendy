import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function validateJWT(authHeader: string | null, supabaseUrl: string, supabaseKey: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header")
  }
  const token = authHeader.slice(7)
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error("Invalid or expired JWT")
  return { user }
}

// ─── Google helpers ───────────────────────────────────────────────────────────

async function exchangeGoogleCode(code: string, codeVerifier: string, redirectUri: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  })

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Google token exchange failed: ${err}`)
  }

  return response.json()
}

async function refreshGoogleToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  })

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Google token refresh failed: ${err}`)
  }

  return response.json()
}

async function getGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.email ?? null
  } catch {
    return null
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const url = new URL(req.url)
  const action = url.searchParams.get("action")

  try {
    const { user } = await validateJWT(
      req.headers.get("Authorization"),
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    )

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (action === "exchange") {
      const body = await req.json() as {
        code: string
        code_verifier: string
        redirect_uri: string
      }

      const { code, code_verifier, redirect_uri } = body
      if (!code || !code_verifier || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
      }

      const tokens = await exchangeGoogleCode(code, code_verifier, redirect_uri)
      const email = await getGoogleUserEmail(tokens.access_token)
      const tokenExpiry = new Date(Date.now() + (tokens.expires_in as number) * 1000).toISOString()

      const { error: upsertError } = await adminClient
        .from("calendar_integrations")
        .upsert(
          {
            user_id: user.id,
            provider: "google",
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token ?? null,
            token_expiry: tokenExpiry,
            email,
            is_active: true,
          },
          { onConflict: "user_id,provider" },
        )

      if (upsertError) throw upsertError

      return new Response(
        JSON.stringify({ success: true, email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (action === "refresh") {
      const { data: integration, error: fetchError } = await adminClient
        .from("calendar_integrations")
        .select("refresh_token")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .single()

      if (fetchError || !integration?.refresh_token) {
        return new Response(
          JSON.stringify({ error: "No refresh token found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
      }

      const tokens = await refreshGoogleToken(integration.refresh_token)
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

      const { error: updateError } = await adminClient
        .from("calendar_integrations")
        .update({ access_token: tokens.access_token, token_expiry: tokenExpiry })
        .eq("user_id", user.id)
        .eq("provider", "google")

      if (updateError) throw updateError

      return new Response(
        JSON.stringify({ access_token: tokens.access_token, token_expiry: tokenExpiry }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use ?action=exchange or ?action=refresh" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
