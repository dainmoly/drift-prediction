import Layout from "@/components/Layout";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useDriftProgram } from "@/hooks/useDriftProgram";
import toast from "react-hot-toast";
import { ComputeBudgetProgram, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import ToastLink from "@/components/ToastLink";
import { useMemo, useState } from "react";
import { getDriftStateAccountPublicKey, getUserAccountPublicKey, getUserStatsAccountPublicKey, encodeName, shortenPubkey } from "@/modules";
import { useGlobalStore, useUserStore } from "@/stores";
import { CONFIRM_OPS } from "@/constants";

export default function Home() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const program = useDriftProgram();

  const { state } = useGlobalStore();
  const { users, fetchUser } = useUserStore();

  const [isLoading, setLoading] = useState(false);

  const user = useMemo(() => {
    if (publicKey) {
      return users.find(t => t.authority.equals(publicKey));
    }
  }, [
    users,
    publicKey
  ])

  const handleInitialize = async () => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state) {
      toast.error("You need to initialize the state account first");
      return;
    }

    const statePda = getDriftStateAccountPublicKey();
    const subAccountId = 0;
    const nameBuffer = encodeName("Main Wallet");

    const toastId = toast.loading("Processing...");

    const user = getUserAccountPublicKey(publicKey);
    const userStats = getUserStatsAccountPublicKey(publicKey);

    try {

      const initStateIx = await program.methods.initializeUserStats()
        .accounts({
          state: statePda,
          userStats,
          authority: publicKey,
          payer: publicKey,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const signature = await program.methods.initializeUser(
        subAccountId, nameBuffer
      )
        .accounts({
          state: statePda,
          user,
          userStats,
          authority: publicKey,
          payer: publicKey,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
          initStateIx,
        ])
        .rpc(CONFIRM_OPS);

      console.log(signature);
      toast.success(<ToastLink signature={signature} />, {
        id: toastId
      });

      await fetchUser(publicKey);

      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (ex) {
      console.log(ex);
      toast.error((ex as Error).message, {
        id: toastId
      });
    }
  }

  return (
    <Layout>

      <form>

        <div className="w-96 mx-auto">

          <h1 className="text-lg font-semibold mb-4">
            Connected wallet: {shortenPubkey(publicKey?.toBase58() ?? "")}
          </h1>

          {
            isLoading ? <p className="my-8">
              Loading...
            </p>
              : <>
                {
                  user ?

                    <div className="w-full flex flex-col gap-6 my-4">

                      <p>
                        Already initialized
                      </p>

                    </div>
                    :
                    <button type="button"
                      className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
                      onClick={handleInitialize}
                      disabled={!publicKey}>
                      Initialize
                    </button>
                }
              </>
          }

        </div>

      </form>

    </Layout>
  );
}
