"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { http } from "viem";
import { SessionProvider } from "next-auth/react";

const rootstockTestnet = {
  id: 31,
  name: "Rootstock Testnet",
  nativeCurrency: { name: "Test RBTC", symbol: "tRBTC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || "https://public-node.testnet.rsk.co"] }
  },
  blockExplorers: {
    default: { name: "Rootstock Explorer", url: "https://explorer.testnet.rsk.co" }
  }
};

const config = getDefaultConfig({
  appName: "PRStake MVP",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [rootstockTestnet],
  transports: {
    [rootstockTestnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL || "https://public-node.testnet.rsk.co")
  },
  ssr: true
});

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}
