import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { JsonRpcProvider, Contract } from "ethers";
import vaultAbi from "@/src/lib/abi/PRStakeVault.json";

export async function GET(_request, { params }) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const vaultAddress = process.env.VAULT_ADDRESS;

    if (!supabaseUrl || !supabaseServiceRole || !rpcUrl || !vaultAddress) {
      return NextResponse.json({ error: "Server env vars are not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);
    const provider = new JsonRpcProvider(rpcUrl);
    const vault = new Contract(vaultAddress, vaultAbi, provider);

    const githubUsername = params.github_username;

    const { data, error } = await supabase
      .from("bindings")
      .select("wallet_address")
      .eq("github_username", githubUsername)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.wallet_address) {
      return NextResponse.json({ eligible: false, wallet: null });
    }

    const deposit = await vault.deposits(data.wallet_address);
    const eligible = deposit > 0n;

    return NextResponse.json({ eligible, wallet: data.wallet_address });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
