import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { JsonRpcProvider, Contract } from "ethers";
import vaultAbi from "@/src/lib/abi/PRStakeVault.json";

export async function GET(_request, { params }) {
  try {
    console.log("[API/CHECK] Request for username:", params.github_username);
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const vaultAddress = process.env.VAULT_ADDRESS;
    console.log("[API/CHECK] Env check - supabaseUrl:", !!supabaseUrl, "serviceRole:", !!supabaseServiceRole, "rpcUrl:", !!rpcUrl, "vaultAddress:", vaultAddress);

    if (!supabaseUrl || !supabaseServiceRole || !rpcUrl || !vaultAddress) {
      console.error("[API/CHECK] Missing required env vars");
      return NextResponse.json({ error: "Server env vars are not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);
    const provider = new JsonRpcProvider(rpcUrl);
    const vault = new Contract(vaultAddress, vaultAbi, provider);
    console.log("[API/CHECK] Created Supabase client and contract instance");

    const githubUsername = params.github_username;

    console.log("[API/CHECK] Querying Supabase for wallet binding...");
    const { data, error } = await supabase
      .from("bindings")
      .select("wallet_address")
      .eq("github_username", githubUsername)
      .maybeSingle();
    console.log("[API/CHECK] Supabase result:", { dataFound: !!data, errorMessage: error?.message, wallet: data?.wallet_address?.slice(0, 10) + "..." });

    if (error) {
      console.error("[API/CHECK] Supabase error:", error);
      return NextResponse.json({ eligible: false, wallet: null, reason: error.message });
    }

    if (!data?.wallet_address) {
      console.log("[API/CHECK] No binding found for user");
      return NextResponse.json({ eligible: false, wallet: null });
    }

    console.log("[API/CHECK] Reading deposit from vault at:", vaultAddress, "for wallet:", data.wallet_address.slice(0, 10) + "...");
    const deposit = await vault.deposits(data.wallet_address);
    const eligible = deposit > 0n;
    console.log("[API/CHECK] Deposit:", deposit.toString(), "Eligible:", eligible);

    return NextResponse.json({ eligible, wallet: data.wallet_address });
  } catch (e) {
    console.error("[API/CHECK] Error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
