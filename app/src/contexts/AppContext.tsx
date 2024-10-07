import { useDriftProgram } from "@/hooks/useDriftProgram";
import { useGlobalStore, useMarketStore, useUserStore } from "@/stores";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PropsWithChildren, createContext, useEffect } from "react";

interface IAppContextProps {
}

export const AppContext = createContext<IAppContextProps>({
});

export const AppContextProvider = (props: PropsWithChildren) => {

  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const program = useDriftProgram();

  const { fetchState } = useGlobalStore();
  const { fetchUser, fetchUserStats, fetchAllUsers } = useUserStore();
  const { fetchPerpMarkets, fetchSpotMarkets } = useMarketStore();

  useEffect(() => {
    fetchState();
    fetchPerpMarkets();
    fetchSpotMarkets();
    fetchAllUsers();
  }, [
  ])

  useEffect(() => {
    if (publicKey) {
      fetchUser(publicKey);
      fetchUserStats(publicKey);
    }
  }, [
    publicKey,
  ])

  return (
    <>
      <AppContext.Provider
        value={{
        }}
      >
        {props.children}
      </AppContext.Provider>
    </>
  );
};
