import Layout from "@/components/Layout";
import { useForm } from "react-hook-form";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";

import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import ToastLink from "@/components/ToastLink";
import { TokenFaucet } from "@/modules/tokenFaucet";
import { BTC_MINT, PYUSD_MINT, TOKEN_FAUCET_PROGRAM_ID, USDC_MINT } from "@/constants";
import { BN } from "bn.js";


type FaucetArgs = {
  mint: string;
  amount: number;
}

export default function ToolFaucet() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();

  const { register, handleSubmit, watch } = useForm<FaucetArgs>({
    defaultValues: {
      mint: "",
      amount: 0,
    }
  });

  const onSubmit = async (data: FaucetArgs) => {
    if (!publicKey || !wallet) {
      toast.error("Check your wallet connection");
      return;
    }

    const toastId = toast.loading("Processing...");

    try {
      const { mint: mint_, amount: amount_ } = data;

      const mint = new PublicKey(mint_);
      const faucet = new TokenFaucet(connection, wallet, TOKEN_FAUCET_PROGRAM_ID, mint);

      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      const ataInfo = await connection.getAccountInfo(ata, 'confirmed');

      var createIx;
      if (!ataInfo) {
        createIx = createAssociatedTokenAccountInstruction(publicKey, ata, publicKey, mint);
      }

      const amount = new BN(amount_ * 10 ** 6);
      const signature = await faucet.mintToUser(ata, amount, createIx);

      if (signature) {
        toast.success(<ToastLink signature={signature} />, {
          id: toastId
        });
      }

    }
    catch (ex) {
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
            Faucet a Token
          </h1>

          <div className="w-full flex flex-col gap-6 my-4">

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Token Mint:</label>
              <select className="text-black"
                {...register('mint', {
                  required: true
                })}>
                <option value={undefined}>--- Select ---</option>
                <option value={USDC_MINT.toBase58()}>USDC</option>
                <option value={BTC_MINT.toBase58()}>BTC</option>
                <option value={PYUSD_MINT.toBase58()}>PYUSD</option>
              </select>
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Amount:</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('amount', {
                  required: true,
                  valueAsNumber: true,
                })} />
            </div>

            <button type="submit"
              className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
              disabled={!publicKey}>
              Mint
            </button>

          </div>

        </div>

      </form>

    </Layout>
  );
}
