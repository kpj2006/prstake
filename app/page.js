"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits, formatUnits, BrowserProvider, JsonRpcProvider, Contract } from "ethers";
import { signIn, signOut, useSession } from "next-auth/react";
import { SIGN_MESSAGE_PREFIX, VAULT_ADDRESS } from "@/src/lib/config";
import vaultAbi from "@/src/lib/abi/PRStakeVault.json";

export default function HomePage() {
  console.log("[INIT] HomePage component mounting...");
  const { data: session, status: sessionStatus } = useSession();
  console.log("[SESSION]", { sessionStatus, sessionUser: session?.user?.githubUsername });
  
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
  const isCorrectChain = chainId === 31;
  const githubUsername = session?.user?.githubUsername;
  const isBound = !!(boundWallet && address && boundWallet.toLowerCase() === address.toLowerCase());
  const claimDisabled = !isConnected || !isBound || openCount !== 0n || depositRaw === 0n || txPending;

  async function readOnchain(walletAddress) {
    console.log("[READ_ONCHAIN] Starting for wallet:", walletAddress);
    if (!walletAddress || VAULT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      console.log("[READ_ONCHAIN] Skip - invalid wallet or VAULT_ADDRESS");
      setOpenCount(0n);
      setDepositRaw(0n);
      return;
    }

    try {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://public-node.testnet.rsk.co";
      console.log("[READ_ONCHAIN] Using RPC:", rpcUrl);
      const provider = new JsonRpcProvider(rpcUrl);
      const vault = new Contract(VAULT_ADDRESS, vaultAbi, provider);
      console.log("[READ_ONCHAIN] Calling openPRCount and deposits for vault:", VAULT_ADDRESS);
      const [count, dep] = await Promise.all([vault.openPRCount(walletAddress), vault.deposits(walletAddress)]);
      console.log("[READ_ONCHAIN] Results - count:", count.toString(), "deposit:", formatUnits(dep, 18));
      setOpenCount(count);
      setDepositRaw(dep);
    } catch (err) {
      console.error("[READ_ONCHAIN] Error:", err);
    }
  }

  async function addRootstockTestnet() {
    console.log("[ADD_NETWORK] Adding Rootstock testnet...");
    if (!window.ethereum) {
      console.error("[ADD_NETWORK] window.ethereum not found!");
      return;
    }
    try {
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
      console.log("[ADD_NETWORK] Successfully added Rootstock Testnet");
    } catch (err) {
      console.error("[ADD_NETWORK] Error:", err);
    }
  }

  async function switchToRootstock() {
    console.log("[SWITCH_CHAIN] Starting chain switch...");
    if (!window.ethereum) {
      console.error("[SWITCH_CHAIN] window.ethereum not found!");
      return;
    }
    setSwitchingChain(true);
    try {
      console.log("[SWITCH_CHAIN] Requesting wallet_switchEthereumChain to 0x1f...");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1f" }]
      });
      console.log("[SWITCH_CHAIN] Successfully switched, reading new chainId...");
      const chainHex = await window.ethereum.request({ method: "eth_chainId" });
      const newChainId = parseInt(chainHex, 16);
      console.log("[SWITCH_CHAIN] New chainId:", newChainId);
      setChainId(newChainId);
    } catch (err) {
      console.error("[SWITCH_CHAIN] Error:", err);
    } finally {
      setSwitchingChain(false);
    }
  }

  async function connectWallet() {
    console.log("[CONNECT_WALLET] Starting...");
    if (!window.ethereum) {
      console.error("[CONNECT_WALLET] window.ethereum not found!");
      setError("MetaMask not found.");
      return;
    }

    console.log("[CONNECT_WALLET] window.ethereum available, requesting accounts...");
    setConnecting(true);
    setError("");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      console.log("[CONNECT_WALLET] Accounts received:", accounts);
      const chainHex = await window.ethereum.request({ method: "eth_chainId" });
      console.log("[CONNECT_WALLET] Chain ID (hex):", chainHex, "parsed:", parseInt(chainHex, 16));

      const selected = accounts?.[0] || "";
      setAddress(selected);
      setChainId(parseInt(chainHex, 16));
      console.log("[CONNECT_WALLET] Set address to:", selected, "chainId:", parseInt(chainHex, 16));
      await readOnchain(selected);
      console.log("[CONNECT_WALLET] Successfully connected");
    } catch (e) {
      console.error("[CONNECT_WALLET] Error:", e);
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
      console.log("[LOAD_BINDING] Loading for username:", githubUsername);
      if (!githubUsername) {
        console.log("[LOAD_BINDING] No GitHub username, clearing bound wallet");
        setBoundWallet(null);
        return;
      }

      try {
        console.log('[LOAD_BINDING] Fetching /api/check/', githubUsername);
        const res = await fetch(`/api/check/${githubUsername}`);
        console.log('[LOAD_BINDING] Response status:', res.status);
        const body = await res.json();
        console.log('[LOAD_BINDING] Response body:', body);
        setBoundWallet(body.wallet || null);
      } catch (err) {
        console.error('[LOAD_BINDING] Error:', err);
        setBoundWallet(null);
      }
    }

    loadBinding().catch(err => {
      console.error('[LOAD_BINDING] Catch error:', err);
      setBoundWallet(null);
    });
  }, [githubUsername]);

  useEffect(() => {
    console.log("[WALLET_LISTENERS] Setting up blockchain listeners...");
    if (!window.ethereum) {
      console.log("[WALLET_LISTENERS] window.ethereum not available");
      return;
    }

    const handleAccounts = (accounts) => {
      console.log("[WALLET_LISTENERS] accountsChanged event:", accounts);
      const selected = accounts?.[0] || "";
      setAddress(selected);
      if (selected) {
        readOnchain(selected).catch(err => console.error("[WALLET_LISTENERS] readOnchain error:", err));
      }
    };

    const handleChain = (hexId) => {
      const newChainId = parseInt(hexId, 16);
      console.log("[WALLET_LISTENERS] chainChanged event, hex:", hexId, "parsed:", newChainId);
      setChainId(newChainId);
      if (address) {
        readOnchain(address).catch(err => console.error("[WALLET_LISTENERS] readOnchain error:", err));
      }
    };

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);
    console.log("[WALLET_LISTENERS] Listeners attached");

    return () => {
      console.log("[WALLET_LISTENERS] Cleaning up listeners...");
      window.ethereum.removeListener("accountsChanged", handleAccounts);
      window.ethereum.removeListener("chainChanged", handleChain);
    };
  }, [address]);

  async function handleBind() {
    console.log("[BIND] Starting bind process...");
    setError("");
    setFeedback("");

    if (!isConnected || !address) {
      console.error("[BIND] Not connected:", { isConnected, address });
      setError("Connect wallet first.");
      return;
    }

    if (!githubUsername) {
      console.error("[BIND] No GitHub username");
      setError("Login with GitHub first.");
      return;
    }

    try {
      const message = `${SIGN_MESSAGE_PREFIX}${githubUsername}`;
      console.log("[BIND] Will sign message:", message);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      console.log("[BIND] Got signer:", signer);
      setSigning(true);
      const signature = await signer.signMessage(message);
      setSigning(false);
      console.log("[BIND] Got signature:", signature);

      console.log("[BIND] Posting to /api/bind...");
      const res = await fetch("/api/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, signature })
      });

      console.log("[BIND] Response status:", res.status);
      const body = await res.json();
      console.log("[BIND] Response body:", body);
      if (!res.ok) {
        console.error("[BIND] Request failed");
        setError(body.error || "Failed to bind wallet.");
        return;
      }

      setBoundWallet(address);
      setFeedback("GitHub username linked successfully.");
      console.log("[BIND] Bind successful");
    } catch (err) {
      console.error("[BIND] Error:", err);
      setError(err?.message || "Bind failed");
    }
  }

  async function handleDeposit() {
    console.log("[DEPOSIT] Starting deposit...");
    setError("");
    setFeedback("");

    if (!isConnected || !address) {
      console.error("[DEPOSIT] Not connected");
      setError("Connect wallet first.");
      return;
    }

    try {
      const amount = parseUnits(depositAmount || "0", 18);
      console.log("[DEPOSIT] Amount string:", depositAmount, "parsed:", amount.toString());
      if (amount <= 0n) {
        console.error("[DEPOSIT] Invalid amount");
        setError("Deposit amount must be greater than zero.");
        return;
      }

      setTxPending(true);
      console.log("[DEPOSIT] Getting provider and signer...");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      console.log("[DEPOSIT] Got signer, creating contract interface...");
      const vault = new Contract(VAULT_ADDRESS, vaultAbi, signer);

      console.log("[DEPOSIT] Calling vault.deposit with value:", amount.toString());
      const tx = await vault.deposit({ value: amount });
      console.log("[DEPOSIT] Tx sent:", tx.hash);
      await tx.wait();
      console.log("[DEPOSIT] Tx confirmed, reading onchain...");
      await readOnchain(address);
      setFeedback("Deposit successful.");
      console.log("[DEPOSIT] Deposit successful");
    } catch (err) {
      console.error("[DEPOSIT] Error:", err);
      setError(err?.message || "Deposit failed");
    } finally {
      setTxPending(false);
    }
  }

  async function handleClaim() {
    console.log("[CLAIM] Starting claim refund...");
    setError("");
    setFeedback("");

    try {
      setTxPending(true);
      console.log("[CLAIM] Getting provider and signer...");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      console.log("[CLAIM] Creating contract interface...");
      const vault = new Contract(VAULT_ADDRESS, vaultAbi, signer);

      console.log("[CLAIM] Calling vault.claimDeposit...");
      const tx = await vault.claimDeposit();
      console.log("[CLAIM] Tx sent:", tx.hash);
      await tx.wait();
      console.log("[CLAIM] Tx confirmed, reading onchain...");
      await readOnchain(address);
      setFeedback("Refund claimed.");
      console.log("[CLAIM] Claim successful");
    } catch (err) {
      console.error("[CLAIM] Error:", err);
      setError(err?.message || "Claim failed");
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
              disabled={!session || !isConnected || !isCorrectChain || !isBound || txPending}
            >
              {txPending ? "Submitting..." : "Deposit tRBTC"}
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
