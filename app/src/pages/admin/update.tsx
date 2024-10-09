import Layout from "@/components/Layout";
import { useForm } from "react-hook-form";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDriftProgram } from "@/hooks/useDriftProgram";
import toast from "react-hot-toast";
import { getDriftStateAccountPublicKey, shortenPubkey } from "@/modules";
import { ComputeBudgetProgram } from "@solana/web3.js";
import ToastLink from "@/components/ToastLink";
import { useGlobalStore } from "@/stores";
import { CONFIRM_OPS } from "@/constants";

type UpdateAdminArgs = {
  admin: string;
}

export default function UpdateAdmin() {
  const { publicKey } = useWallet();
  const program = useDriftProgram();

  const { state, fetchState } = useGlobalStore();

  const { register, handleSubmit } = useForm<UpdateAdminArgs>({
    defaultValues: {
      admin: state?.admin.toBase58() ?? "",
    }
  });

  const onSubmit = async (data: UpdateAdminArgs) => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state) {
      toast.error("Initialize state");
      return;
    }

    const admin = state.admin;
    if (!admin.equals(publicKey)) {
      if (admin.toBase58() != publicKey.toBase58()) {
        toast.error(`You need to connect ${shortenPubkey(admin.toBase58())} wallet`);
        return;
      }
    }

    const statePda = getDriftStateAccountPublicKey();

    const toastId = toast.loading("Processing...");

    try {
      const signature = await program.methods.updateAdmin(
        publicKey,
      )
        .accounts({
          admin,
          state: statePda,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          })
        ])
        .rpc(CONFIRM_OPS);

      console.log(signature);
      await Promise.all([
        fetchState()
      ]);
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
            Update Admin
          </h1>


          {
            !state ?
              <div className="flex flex-col gap-4">
                You need to initialize first
              </div>
              :
              <div className="w-full flex flex-col gap-6 my-4">
                <div className="w-full flex flex-col gap-2">
                  <label className="text-md">Admin Address</label>
                  <input type="text"
                    className="form-control text-sm text-black"
                    {...register('admin', {
                      required: true
                    })} />
                </div>

                <button type="submit"
                  className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
                  disabled={!publicKey}>
                  Update
                </button>

              </div>
          }

        </div>

      </form>

    </Layout>
  );
}
