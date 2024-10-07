import Layout from "@/components/Layout";
import { useForm } from "react-hook-form";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import { percentAmount, generateSigner, signerIdentity, createSignerFromKeypair, publicKey, signTransaction } from '@metaplex-foundation/umi'
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters'
import { TokenStandard, createAndMint, createMetadataAccountV3, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { createAssociatedTokenAccountInstruction, createInitializeInstruction, createInitializeMetadataPointerInstruction, createInitializeMintInstruction, createMintToCheckedInstruction, createUpdateFieldInstruction, ExtensionType, getAssociatedTokenAddressSync, getMintLen, LENGTH_SIZE, mintToChecked, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, TYPE_SIZE } from "@solana/spl-token";
import { Keypair, sendAndConfirmRawTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { pack, TokenMetadata } from "@solana/spl-token-metadata";
import ToastLink from "@/components/ToastLink";
import { CONFIRM_OPS } from "@/constants";


type TokenArgs = {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  totalSupply: number;
  isToken22: boolean;
}

export default function CreateToken() {
  const { push } = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();

  const { register, handleSubmit, watch } = useForm<TokenArgs>({
    defaultValues: {
      name: "",
      symbol: "",
      uri: "",
      decimals: 6,
      totalSupply: 1_000_000_000,
      isToken22: false,
    }
  });

  const onSubmit = async (data: TokenArgs) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error("Check your wallet connection");
      return;
    }

    const toastId = toast.loading("Processing...");

    try {
      const { name, symbol, uri, totalSupply, isToken22, decimals } = data;

      const umi = createUmi(connection);
      const mint = generateSigner(umi);
      umi.use(walletAdapterIdentity(wallet));
      umi.use(mplTokenMetadata());

      if (isToken22) {

        const mintKeypair = Keypair.generate();
        const mint = mintKeypair.publicKey;
        const payer = wallet.publicKey;
        const authority = wallet.publicKey;

        const tokenMetadata: TokenMetadata = {
          updateAuthority: authority,
          mint,
          name,
          symbol,
          uri,
          additionalMetadata: [],
        };
        const mintLen = getMintLen([ExtensionType.MetadataPointer]);
        const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(tokenMetadata).length;
        const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
        const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);

        const transaction = new Transaction().add(
          SystemProgram.createAccount({
            fromPubkey: payer,
            newAccountPubkey: mint,
            space: mintLen,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
          }),
          createInitializeMetadataPointerInstruction(
            mint,
            authority,
            mint,
            TOKEN_2022_PROGRAM_ID,
          ),
          createInitializeMintInstruction(
            mint,
            decimals,
            authority,
            null,
            TOKEN_2022_PROGRAM_ID,
          ),
          createInitializeInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            metadata: mint,
            updateAuthority: authority,
            mint,
            mintAuthority: authority,
            name,
            symbol,
            uri,
          }),
          createAssociatedTokenAccountInstruction(
            payer,
            ata,
            authority,
            mint,
            TOKEN_2022_PROGRAM_ID,
          ),
          createMintToCheckedInstruction(
            mint,
            ata,
            authority,
            totalSupply * 10 ** decimals,
            decimals,
            [],
            TOKEN_2022_PROGRAM_ID,
          ),
        );
        const blockHash = await connection.getLatestBlockhash();
        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = blockHash.blockhash;
        transaction.sign(mintKeypair);
        const tx = await wallet.signTransaction(transaction);

        const signature = await sendAndConfirmRawTransaction(connection, tx.serialize(), CONFIRM_OPS);
        toast.success(<ToastLink signature={signature} />, {
          id: toastId
        });
      }
      else {
        const tx = await createAndMint(umi, {
          mint,
          authority: umi.identity,
          name: name,
          symbol: symbol,
          uri: uri,
          sellerFeeBasisPoints: percentAmount(0),
          decimals: decimals,
          amount: totalSupply * 10 ** decimals,
          tokenOwner: publicKey(wallet.publicKey.toBase58()),
          tokenStandard: TokenStandard.Fungible,
          splTokenProgram: publicKey(isToken22 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID)
        }).sendAndConfirm(umi, {
          confirm: {
            commitment: 'confirmed',
          },
          send: {
            commitment: 'confirmed',
            maxRetries: 10,
          }
        });
        const signature = bs58.encode(tx.signature);

        toast.success(<ToastLink signature={signature} />, {
          id: toastId
        });
      }


      setTimeout(() => {
        push('/');
      }, 3000);
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
            Create a Token
          </h1>
          <p>
            Input fields to create a token
          </p>

          <div className="w-full flex flex-col gap-6 my-4">

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Token Name:</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('name', {
                  required: true
                })} />
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Symbol:</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('symbol', {
                  required: true
                })} />
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Uri:</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('uri', {
                  required: false
                })} />
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Decimals:</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('decimals', {
                  required: true,
                  valueAsNumber: true,
                  max: 9,
                  min: 1,
                })} />
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Total Supply</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('totalSupply', {
                  valueAsNumber: true,
                  required: true
                })} />
            </div>

            <div className="w-full flex gap-2 items-center">
              <label className="text-md">Is Token22</label>
              <input type="checkbox"
                id="chk-token22"
                className="form-control text-sm text-black"
                {...register('isToken22')} />
            </div>

            <button type="submit"
              className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
              disabled={!publicKey}>
              Create
            </button>

          </div>

        </div>

      </form>

    </Layout>
  );
}
