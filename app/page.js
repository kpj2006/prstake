"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseUnits, formatUnits } from "viem";
import { signIn, signOut, useSession } from "next-auth/react";
import { useAccount, useReadContract, useSignMessage, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { SIGN_MESSAGE_PREFIX, VAULT_ADDRESS } from "@/src/lib/config";
import vaultAbi from "@/src/lib/abi/PRStakeVault.json";

export default function HomePage() {
  const { data: session, status: sessionStatus } = useSession();
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState("0.01");
  const [boundWallet, setBoundWallet] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const { signMessageAsync, isPending: signing } = useSignMessage();
  const { writeContractAsync, data: txHash, isPending: txPending } = useWriteContract();
  const { isLoading: txConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: openCount = 0n, refetch: refetchOpenCount } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "openPRCount",
    args: address ? [address] : undefined,
    query: { enabled: !!address && VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000" }
  });

  const { data: depositRaw = 0n, refetch: refetchDeposit } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "deposits",
    args: address ? [address] : undefined,
    query: { enabled: !!address && VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000" }
  });

  const formattedDeposit = useMemo(() => formatUnits(depositRaw, 18), [depositRaw]);
  const claimDisabled = !isConnected || !isBound || openCount !== 0n || depositRaw === 0n || txPending || txConfirming;
  const githubUsername = session?.user?.githubUsername;
  const isBound = !!(boundWallet && address && boundWallet.toLowerCase() === address.toLowerCase());

  useEffect(() => {
    async function loadBinding() {
      if (!githubUsername) {
        setBoundWallet(null);
        return;
      }

      const res = await fetch(`/api/check/${githubUsername}`);
      const body = await res.json();
      setBoundWallet(body.wallet || null);
    }

    loadBinding().catch(() => setBoundWallet(null));
  }, [githubUsername, txHash]);

  async function handleBind() {
    setError("");
    setFeedback("");

    if (!isConnected || !address) {
      setError("Connect wallet first.");
      return;
    }

    if (!githubUsername) {
      setError("Login with GitHub first.");
      return;
    }

    const message = `${SIGN_MESSAGE_PREFIX}${githubUsername}`;
    const signature = await signMessageAsync({ message });

    const res = await fetch("/api/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, signature })
    });

    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Failed to bind wallet.");
      return;
    }

    setBoundWallet(address);
    setFeedback("GitHub username linked successfully.");
  }

  async function handleDeposit() {
    setError("");
    setFeedback("");

    if (!isConnected || !address) {
      setError("Connect wallet first.");
      return;
    }

    const amount = parseUnits(depositAmount || "0", 18);
    if (amount <= 0n) {
      setError("Deposit amount must be greater than zero.");
      return;
    }

    await writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "deposit",
      value: amount
    });

    await refetchDeposit();
    await refetchOpenCount();
    setFeedback("Deposit successful.");
  }

  async function handleClaim() {
    setError("");
    setFeedback("");

    await writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "claimDeposit"
    });

    await refetchDeposit();
    await refetchOpenCount();
    setFeedback("Refund claimed.");
  }

  return (
    <main className="wrap">
      <h1 className="title">PRStake MVP</h1>
      <p className="subtitle">GitHub login to wallet bind to tRBTC deposit, with up to 10 concurrent PR slots.</p>

      <section className="card">
        <h3>Step 1 - GitHub login</h3>
        {sessionStatus === "loading" ? <p className="muted">Checking session...</p> : null}
        {session ? (
          <div className="row">
            <p style={{ margin: 0 }}>Signed in as @{githubUsername}</p>
            <button className="btn secondary" onClick={() => signOut()}>
              Logout
            </button>
          </div>
        ) : (
          <button className="btn" onClick={() => signIn("github")}>
            Login with GitHub
          </button>
        )}
      </section>

      {session ? (
        <section className="card">
          <h3>Step 2 - Connect wallet</h3>
          <ConnectButton />
        </section>
      ) : null}

      {session && isConnected ? (
        <section className="card">
          <h3>Step 3 - Bind wallet to GitHub</h3>
          <p className="muted">Sign message: {SIGN_MESSAGE_PREFIX}{githubUsername || "<username>"}</p>
          <button className="btn secondary" onClick={handleBind} disabled={!session || !isConnected || signing}>
            {signing ? "Signing..." : "Sign & Bind"}
          </button>
          {boundWallet ? <p className="muted">Bound wallet: {boundWallet}</p> : null}
        </section>
      ) : null}

      {session && isConnected && isBound ? (
        <section className="card">
          <h3>Step 4 - Deposit</h3>
          <div className="row">
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount in tRBTC"
            />
            <button
              className="btn"
              onClick={handleDeposit}
              disabled={!session || !isConnected || !isBound || txPending || txConfirming}
            >
              {txPending || txConfirming ? "Submitting..." : "Deposit tRBTC"}
            </button>
          </div>
        </section>
      ) : null}

      {session && isConnected && isBound && depositRaw > 0n ? (
        <section className="card">
          <h3>Status + Refund</h3>
          <div className="kv">
            <span>Open PR slots used</span>
            <strong>{openCount.toString()} / 10</strong>
            <span>Deposit amount</span>
            <strong>{formattedDeposit} tRBTC</strong>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn danger" onClick={handleClaim} disabled={claimDisabled}>
              Claim Refund
            </button>
          </div>
          <p className="muted">Claim is available only when open count is zero.</p>
        </section>
      ) : null}

      {feedback ? <p className="ok">{feedback}</p> : null}
      {error ? <p className="err">{error}</p> : null}
    </main>
  );
}
