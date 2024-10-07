import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { Toaster } from "react-hot-toast";

import type { AppProps } from "next/app";
import Head from "next/head";
import { SolanaWalletProvider } from "@/contexts/SolanaWalletProvider";

import "@fontsource/inter/200.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "@/styles/globals.css";
import { AppContextProvider } from "@/contexts/AppContext";

export default function App({
  Component,
  pageProps: { ...pageProps },
}: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [showChild, setShowChild] = useState(false);
  useEffect(() => {
    setShowChild(true);
  }, []);
  if (!showChild) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Drift Protocol V2 Demo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      <QueryClientProvider client={queryClient}>
        <SolanaWalletProvider>
          <AppContextProvider>
            <Component {...pageProps} />
            <Toaster position="bottom-right" />
          </AppContextProvider>
        </SolanaWalletProvider>
      </QueryClientProvider>
    </>
  );
}
