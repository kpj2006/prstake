"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits, formatUnits, BrowserProvider, JsonRpcProvider, Contract } from "ethers";
import { signIn, signOut, useSession } from "next-auth/react";
import { SIGN_MESSAGE_PREFIX, VAULT_ADDRESS } from "@/src/lib/config";
import vaultAbi from "@/src/lib/abi/PRStakeVault.json";

export default function HomePage() {
  const { data: session, status: sessionStatus } = useSession();
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [switchingChain, setSwitchingChain] = useState(false);
  const [signing, setSigning] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [depositAmount, setDepositAmount] = useState("0.01");
  const [boundWallet, setBoundWallet] = useState(null);
  const [openCount, setOpenCount] = useState(0n);
  const [depositRaw, setDepositRaw] = useState(0n);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const formattedDeposit = useMemo(() => formatUnits(depositRaw, 18), [depositRaw]);
  const isConnected = !!address;
  const claimDisabled = !isConnected || !isBound || openCount !== 0n || depositRaw === 0n || txPending;
  const isCorrectChain = chainId === 31;
  const githubUsername = session?.user?.githubUsername;
  const isBound = !!(boundWallet && address && boundWallet.toLowerCase() === address.toLowerCase());

  async function readOnchain(walletAddress) {
    if (!walletAddress || VAULT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setOpenCount(0n);
      setDepositRaw(0n);
      return;
    }

    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || "https://public-node.testnet.rsk.co");
    const vault = new Contract(VAULT_ADDRESS, vaultAbi, provider);
    const [count, dep] = await Promise.all([vault.openPRCount(walletAddress), vault.deposits(walletAddress)]);

    setOpenCount(count);
    setDepositRaw(dep);
  }

  async function addRootstockTestnet() {
    if (!window.ethereum) return;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x1f",
          chainName: "Rootstock Testnet",
          nativeCurrency: {
            name: "Test RBTC",
            symbol: "tRBTC",
            decimals: 18
          },
          rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL || "https://public-node.testnet.rsk.co"],
          blockExplorerUrls: ["https://explorer.testnet.rsk.co"]
        }
      ]
    });
  }

  async function switchToRootstock() {
    if (!window.ethereum) return;
    setSwitchingChain(true);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1f" }]
      });
      const chainHex = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(chainHex, 16));
    } finally {
      setSwitchingChain(false);
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setError("MetaMask not found.");
      return;
    }

    setConnecting(true);
    setError("");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainHex = await window.ethereum.request({ method: "eth_chainId" });

      const selected = accounts?.[0] || "";
      setAddress(selected);
      setChainId(parseInt(chainHex, 16));
      await readOnchain(selected);
    } catch (e) {
      setError(e?.message || "Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectWallet() {
    // Browser-injected wallets don't support true dapp-side disconnect.
    setAddress("");
    setChainId(null);
    setBoundWallet(null);
    setOpenCount(0n);
    setDepositRaw(0n);
  }

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
  }, [githubUsername]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccounts = (accounts) => {
      const selected = accounts?.[0] || "";
      setAddress(selected);
      if (selected) {
        readOnchain(selected).catch(() => undefined);
      }
    };

    const handleChain = (hexId) => {
      setChainId(parseInt(hexId, 16));
      if (address) {
        readOnchain(address).catch(() => undefined);
      }
    };

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccounts);
      window.ethereum.removeListener("chainChanged", handleChain);
    };
  }, [address]);

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
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    setSigning(true);
    const signature = await signer.signMessage(message);
    setSigning(false);

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

    setTxPending(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vault = new Contract(VAULT_ADDRESS, vaultAbi, signer);

      const tx = await vault.deposit({ value: amount });
      await tx.wait();
      await readOnchain(address);
      setFeedback("Deposit successful.");
    } finally {
      setTxPending(false);
    }
  }

  async function handleClaim() {
    setError("");
    setFeedback("");

    setTxPending(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vault = new Contract(VAULT_ADDRESS, vaultAbi, signer);

      const tx = await vault.claimDeposit();
      await tx.wait();
      await readOnchain(address);
      setFeedback("Refund claimed.");
    } finally {
      setTxPending(false);
    }
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
          {isConnected ? (
            <div className="row">
              <p style={{ margin: 0 }}>Connected: {address}</p>
              <button className="btn secondary" onClick={disconnectWallet}>
                Disconnect Wallet
              </button>
            </div>
          ) : (
            <button className="btn" onClick={connectWallet} disabled={connecting}>
              {connecting ? "Connecting..." : "Connect MetaMask"}
            </button>
          )}

          {isConnected && !isCorrectChain ? (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={switchToRootstock} disabled={switchingChain}>
                {switchingChain ? "Switching..." : "Switch to Rootstock Testnet"}
              </button>
              <button className="btn secondary" onClick={addRootstockTestnet}>
                Add Rootstock to MetaMask
              </button>
            </div>
          ) : null}
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
              disabled={!session || !isConnected || !isCorrectChain || !isBound || txPending || txConfirming}
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
