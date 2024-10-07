import { DRIFT_PROGRAM_ID, RPC_URL } from "@/constants";
import { Drift, IDL } from "@/modules/idls/drift";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, Keypair } from "@solana/web3.js";

import { useMemo } from "react";

export const useDriftProgram = () => {
  const anchorWallet = useAnchorWallet();

  const program = useMemo(() => {
    const connection = new Connection(RPC_URL);

    if (anchorWallet) {
      const provider = new AnchorProvider(
        connection,
        anchorWallet,
        {
          commitment: "confirmed",
          preflightCommitment: "confirmed",
          maxRetries: 10,
        }
      );

      return new Program<Drift>(
        IDL,
        DRIFT_PROGRAM_ID,
        provider
      );
    } else {
      return undefined;
    }
  }, [anchorWallet]);

  return program;
};
