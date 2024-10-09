import Layout from "@/components/Layout";
import { useForm } from "react-hook-form";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";

import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import ToastLink from "@/components/ToastLink";
import { TokenFaucet } from "@/modules/tokenFaucet";
import { BTC_MINT, PYUSD_MINT, TOKEN_FAUCET_PROGRAM_ID, USDC_MINT } from "@/constants";
import { BN } from "bn.js";
import { useState } from "react";


type PkArgs = {
  pk: string;
}

export default function ToolFaucet() {

  const [pubkey, setPubkey] = useState<string>();

  const { register, handleSubmit, watch } = useForm<PkArgs>({
    defaultValues: {
      pk: "",
    }
  });

  const onSubmit = async (data: PkArgs) => {
    const signer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(data.pk)));
    setPubkey(signer.publicKey.toBase58());
  }

  return (
    <Layout>

      <form onSubmit={handleSubmit(onSubmit)}>

        <div className="w-96 mx-auto">

          <h1 className="text-lg font-semibold">
            Retrieve PublicKey from Keypair
          </h1>

          <div className="w-full flex flex-col gap-6 my-4">

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Keypair:</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('pk', {
                  required: true,
                })} />
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Pubkey:</label>
              <input type="text"
                className="form-control text-sm text-black"
                readOnly
                value={pubkey} />
            </div>

            <button type="submit"
              className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50">
              Show
            </button>

          </div>

        </div>

      </form>

    </Layout >
  );
}
