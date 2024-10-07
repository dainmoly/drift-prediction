import Layout from "@/components/Layout";
import { useForm } from "react-hook-form";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useDriftProgram } from "@/hooks/useDriftProgram";
import toast from "react-hot-toast";
import { getDriftSignerPublicKey, getDriftStateAccountPublicKey } from "@/modules";
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import ToastLink from "@/components/ToastLink";
import { useGlobalStore } from "@/stores";
import { CONFIRM_OPS } from "@/constants";

type InitializeArgs = {
  quoteMint: string;
}

export default function Initialize() {
  const { publicKey } = useWallet();
  const program = useDriftProgram();

  const { state, fetchState } = useGlobalStore();

  const { register, handleSubmit } = useForm<InitializeArgs>({
    defaultValues: {
      quoteMint: "So11111111111111111111111111111111111111112",
    }
  });

  const onSubmit = async (data: InitializeArgs) => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    const admin = publicKey;
    const statePda = getDriftStateAccountPublicKey();
    const signer = getDriftSignerPublicKey();

    const toastId = toast.loading("Processing...");

    try {
      const quoteMint = new PublicKey(data.quoteMint);

      const signature = await program.methods.initialize()
        .accounts({
          admin,
          state: statePda,
          quoteAssetMint: quoteMint,
          rent: SYSVAR_RENT_PUBKEY,
          driftSigner: signer,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          })
        ])
        .rpc(CONFIRM_OPS);

      console.log(signature);
      toast.success(<ToastLink signature={signature} />, {
        id: toastId
      });

      await fetchState();
    } catch (ex) {
      console.log(ex);
      toast.error((ex as Error).message, {
        id: toastId
      });
    }
  }

  return (
    <Layout>

      <form onSubmit={handleSubmit(onSubmit)}>

        <div className="w-96 mx-auto">

          <h1 className="text-lg font-semibold">
            Initialize configuration
          </h1>


          {
            state ?
              <p>
                Already initialized
              </p>
              :
              <div className="w-full flex flex-col gap-6 my-4">
                <div className="w-full flex flex-col gap-2">
                  <label className="text-md">Quote Asset Address</label>
                  <input type="text"
                    className="form-control text-sm text-black"
                    {...register('quoteMint', {
                      required: true
                    })} />
                </div>

                <button type="submit"
                  className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
                  disabled={!publicKey}>
                  Initialize
                </button>

              </div>
          }

        </div>

      </form>

    </Layout>
  );
}
