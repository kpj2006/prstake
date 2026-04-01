import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyMessage, getAddress } from "ethers";
import { getServerSession } from "next-auth";
import { SIGN_MESSAGE_PREFIX } from "@/src/lib/config";
import { authOptions } from "@/src/lib/auth";

export async function POST(request) {
  try {
    console.log("[API/BIND] Request received");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRole) {
      console.error("[API/BIND] Missing Supabase env vars");
      return NextResponse.json({ error: "Supabase env vars are not configured" }, { status: 500 });
    }

    console.log("[API/BIND] Getting server session...");
    const session = await getServerSession(authOptions);
    console.log("[API/BIND] Session:", session?.user?.githubUsername);
    const github_username = session?.user?.githubUsername;
    if (!github_username) {
      console.error("[API/BIND] No GitHub username in session");
      return NextResponse.json({ error: "GitHub login required" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);
    const { wallet, signature } = await request.json();
    console.log(
      "[API/BIND] Parsed request - wallet:",
      wallet ? wallet.slice(0, 10) + "..." : "<missing>",
      "signature length:",
      signature ? signature.length : 0
    );

    if (!wallet || !signature) {
      console.error("[API/BIND] Missing wallet or signature");
      return NextResponse.json({ error: "Missing wallet or signature" }, { status: 400 });
    }

    const message = `${SIGN_MESSAGE_PREFIX}${github_username}`;
    console.log("[API/BIND] Expected message:", message);
    const recovered = verifyMessage(message, signature);
    console.log("[API/BIND] Recovered address:", recovered);

    const walletChecksum = getAddress(wallet);
    const recoveredChecksum = getAddress(recovered);
    console.log("[API/BIND] Comparing wallet:", walletChecksum, "vs recovered:", recoveredChecksum);
    
    if (recoveredChecksum !== walletChecksum) {
      console.error("[API/BIND] Signature mismatch - wallet does not match recovered address");
      return NextResponse.json({ error: "Signature does not match wallet" }, { status: 400 });
    }

    console.log("[API/BIND] Signature valid, upserting to Supabase...");
    const payload = {
      wallet_address: walletChecksum,
      github_username,
      signature
    };

    const { error } = await supabase.from("bindings").upsert(payload, { onConflict: "wallet_address" });
    console.log("[API/BIND] Supabase upsert result:", { errorMessage: error?.message, errorCode: error?.code });

    if (error) {
      console.error("[API/BIND] Supabase error:", error.message, error.code, error.details);
      if ((error.message || "").includes("Could not find the table 'public.bindings'")) {
        return NextResponse.json(
          {
            error: "Supabase table 'bindings' is missing. Run: npx supabase db push"
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log("[API/BIND] Success, returning result");
    return NextResponse.json({ ok: true, wallet: payload.wallet_address, github_username });
  } catch (e) {
    console.error("[API/BIND] Catch error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
