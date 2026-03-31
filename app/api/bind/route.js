import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyMessage, getAddress } from "ethers";
import { getServerSession } from "next-auth";
import { SIGN_MESSAGE_PREFIX } from "@/src/lib/config";
import { authOptions } from "@/src/lib/auth";

export async function POST(request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRole) {
      return NextResponse.json({ error: "Supabase env vars are not configured" }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    const github_username = session?.user?.githubUsername;
    if (!github_username) {
      return NextResponse.json({ error: "GitHub login required" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);
    const { wallet, signature } = await request.json();

    if (!wallet || !signature) {
      return NextResponse.json({ error: "Missing wallet or signature" }, { status: 400 });
    }

    const message = `${SIGN_MESSAGE_PREFIX}${github_username}`;
    const recovered = verifyMessage(message, signature);

    if (getAddress(recovered) !== getAddress(wallet)) {
      return NextResponse.json({ error: "Signature does not match wallet" }, { status: 400 });
    }

    const payload = {
      wallet_address: getAddress(wallet),
      github_username,
      signature
    };

    const { error } = await supabase.from("bindings").upsert(payload, { onConflict: "wallet_address" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, wallet: payload.wallet_address, github_username });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
