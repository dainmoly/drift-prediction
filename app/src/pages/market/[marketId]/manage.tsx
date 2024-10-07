import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { useRouter } from "next/router";
import { PublicKey, AccountMeta, ComputeBudgetProgram, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createSyncNativeInstruction, getAccount, getAssociatedTokenAddressSync, getMint, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

import Layout from "@/components/Layout";
import ToastLink from "@/components/ToastLink";
import { CONFIRM_OPS, PRICE_PRECISION } from "@/constants";
import { useDriftProgram } from "@/hooks/useDriftProgram";
import { isVariant, decodeName, decodeUserData, getDriftSignerPublicKey, getDriftStateAccountPublicKey, getSpotMarketPublicKey, getSpotMarketVaultPublicKey, getUserAccountPublicKey, getUserStatsAccountPublicKey, unifyArray, getPerpMarketPublicKey } from "@/modules";
import { getOracleClient } from "@/modules/oracles/oracleClient";
import { useGlobalStore, useMarketStore, useUserStore } from "@/stores";

type DepositArgs = {
  amount: number;
}

export default function Manage() {

  const router = useRouter();
  const { marketId } = router.query;

  const { state } = useGlobalStore();
  const { spotMarkets, perpMarkets } = useMarketStore();
  const { users } = useUserStore();

  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const program = useDriftProgram();

  const market = useMemo(() => {
    const marketIdx = parseInt(marketId as string);
    const market = spotMarkets.find(t => t.marketIndex == marketIdx);
    return market;
  }, [
    marketId,
    spotMarkets,
  ])

  const { register, watch } = useForm<DepositArgs>({
    defaultValues: {
      amount: 0
    }
  });
  const amount = watch('amount');

  const [decimals, setDecimals] = useState(0);
  const [price, setPrice] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [isLoading, setLoading] = useState(false);

  const walletBalance_ = useMemo(() => {
    return walletBalance / (10 ** decimals);
  }, [
    walletBalance,
    decimals
  ])

  const vaultBalance_ = useMemo(() => {
    return vaultBalance / (10 ** decimals);
  }, [
    vaultBalance,
    decimals
  ])

  useEffect(() => {
    fetchMint();
    fetchMarketPrice();
  }, [
    market
  ])

  useEffect(() => {
    fetchTokenBalance();
    fetchVaultBalance();
  }, [
    market,
    publicKey
  ])

  const user = useMemo(() => {
    if (publicKey) {
      return users.find(t => t.authority.equals(publicKey));
    }
  }, [
    users,
    publicKey,
  ])

  const fetchMint = async () => {
    if (!market) {
      return;
    }

    setLoading(true);

    try {
      const mintAccount = await getMint(connection, market.mint, 'confirmed');
      const decimals = mintAccount.decimals;
      setDecimals(decimals);
    }
    catch {
      setDecimals(0);
    }

    setLoading(false);
  }

  const fetchTokenBalance = async () => {
    if (!market || !publicKey) {
      return;
    }

    setLoading(true);

    const mint = market.mint;
    const userTokenAccount = getAssociatedTokenAddressSync(mint, publicKey);

    try {
      if (mint.equals(NATIVE_MINT)) {
        const balance = await connection.getBalance(publicKey, 'confirmed')
        setWalletBalance(balance);
      }
      else {
        const ata = await getAccount(connection, userTokenAccount, 'confirmed');
        setWalletBalance(Number(ata.amount));
      }

    }
    catch {
      setWalletBalance(0);
    }

    setLoading(false);
  }

  const fetchVaultBalance = async () => {
    if (!market || !publicKey) {
      return;
    }

    setLoading(true);

    const userAccount = getUserAccountPublicKey(publicKey);

    try {
      const userData = await connection.getAccountInfo(userAccount);
      if (userData) {
        const user = decodeUserData(userData.data);
        const position = user.spotPositions.find(t => t.marketIndex == market.marketIndex && isVariant(t.balanceType, 'deposit') && t.cumulativeDeposits.gt(new BN(0)));
        if (position) {
          setVaultBalance(position.cumulativeDeposits.toNumber());
        }
      }

    }
    catch {
      setWalletBalance(0);
    }

    setLoading(false);
  }

  const fetchMarketPrice = async () => {
    if (!market || !program) {
      return;
    }

    setLoading(true);

    const oracleClient = getOracleClient(market.oracleSource, connection, program);
    const oracleData = await oracleClient.getOraclePriceData(market.oracle);
    if (oracleData) {
      setPrice(Number(oracleData.price) / Number(PRICE_PRECISION));
    }

    setLoading(false);
  }

  const handleDeposit = async () => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state) {
      toast.error("You need to initialize the state account first");
      return;
    }

    if (!market) {
      toast.error("Market not loaded");
      return;
    }

    const statePda = getDriftStateAccountPublicKey();
    const marketIndex = market.marketIndex;

    const mint = market.mint;
    const userAccountPublicKey = getUserAccountPublicKey(publicKey);
    const userStatsPublicKey = getUserStatsAccountPublicKey(publicKey);
    const userTokenAccount = getAssociatedTokenAddressSync(mint, publicKey);

    const spotMarketPubkey = getSpotMarketPublicKey(marketIndex);
    const spotMarketVault = getSpotMarketVaultPublicKey(marketIndex);
    const toastId = toast.loading("Processing...");

    const amount_ = new BN(amount * 10 ** decimals);

    const prevIxs: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 100_000_000
      }),
    ];
    const postIxs: TransactionInstruction[] = [];

    if (mint.equals(NATIVE_MINT)) {

      prevIxs.push(
        createAssociatedTokenAccountInstruction(publicKey, userTokenAccount, publicKey, NATIVE_MINT),
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: userTokenAccount,
          lamports: amount_.toNumber(),
        }),
        createSyncNativeInstruction(userTokenAccount)
      );

      postIxs.push(
        createCloseAccountInstruction(userTokenAccount, publicKey, publicKey)
      );
    }

    const remainingAccounts: AccountMeta[] = [];

    if (!market.oracle.equals(PublicKey.default)) {
      remainingAccounts.push({
        pubkey: market.oracle,
        isSigner: false,
        isWritable: true,
      })
    }

    remainingAccounts.push({
      pubkey: spotMarketPubkey,
      isSigner: false,
      isWritable: true,
    })

    try {
      const reduceOnly = false;
      const signature = await program.methods.deposit(
        marketIndex,
        amount_,
        reduceOnly,
      )
        .accounts({
          state: statePda,
          spotMarketVault,
          user: userAccountPublicKey,
          userStats: userStatsPublicKey,
          userTokenAccount,
          authority: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(prevIxs)
        .remainingAccounts(remainingAccounts)
        .rpc(CONFIRM_OPS);

      console.log(signature);
      toast.success(<ToastLink signature={signature} />, {
        id: toastId
      });

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

  const handleWithdraw = async () => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state || !user) {
      toast.error("You need to initialize the state account first");
      return;
    }

    if (!market) {
      toast.error("Market not loaded");
      return;
    }

    const statePda = getDriftStateAccountPublicKey();
    const marketIndex = market.marketIndex;

    const mint = market.mint;
    const userAccountPublicKey = getUserAccountPublicKey(publicKey);
    const userStatsPublicKey = getUserStatsAccountPublicKey(publicKey);
    const userTokenAccount = getAssociatedTokenAddressSync(mint, publicKey);
    const spotMarketVault = getSpotMarketVaultPublicKey(marketIndex);
    const driftSigner = getDriftSignerPublicKey();

    const toastId = toast.loading("Processing...");

    const decimals = 6;
    const amount_ = new BN(amount * 10 ** decimals);
    const reduceOnly = false;

    const remainingAccounts: AccountMeta[] = [];

    let spotIdxs: number[] = [
      market.marketIndex,
    ];
    for (const position of user.spotPositions) {
      if (position.openOrders > 0 || !position.scaledBalance.isZero()) {
        spotIdxs.push(position.marketIndex);
      }
    }
    spotIdxs = unifyArray(spotIdxs);

    let perpIdxs: number[] = [];
    for (const position of user.perpPositions) {
      if (position.openOrders > 0 || !position.baseAssetAmount.isZero()) {
        perpIdxs.push(position.marketIndex);
      }
    }
    perpIdxs = unifyArray(perpIdxs);

    console.log(user, perpIdxs)

    // Oracles
    for (const idx of spotIdxs) {
      const market = spotMarkets.find(t => t.marketIndex == idx);
      if (market && !market.oracle.equals(PublicKey.default)) {
        remainingAccounts.push({
          pubkey: market.oracle,
          isSigner: false,
          isWritable: true,
        })
      }
    }
    for (const idx of perpIdxs) {
      const market = perpMarkets.find(t => t.marketIndex == idx);
      if (market && !market.amm.oracle.equals(PublicKey.default)) {
        remainingAccounts.push({
          pubkey: market.amm.oracle,
          isSigner: false,
          isWritable: true,
        })
      }
    }

    // Spot markets
    for (const idx of spotIdxs) {
      remainingAccounts.push({
        pubkey: getSpotMarketPublicKey(idx),
        isSigner: false,
        isWritable: true,
      })
    }

    // Perp markets
    for (const idx of perpIdxs) {
      remainingAccounts.push({
        pubkey: getPerpMarketPublicKey(idx),
        isSigner: false,
        isWritable: true,
      })
    }

    try {
      const signature = await program.methods.withdraw(
        marketIndex,
        amount_,
        reduceOnly,
      )
        .accounts({
          state: statePda,
          spotMarketVault,
          user: userAccountPublicKey,
          driftSigner,
          userStats: userStatsPublicKey,
          userTokenAccount,
          authority: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
        ])
        .remainingAccounts(remainingAccounts)
        .rpc(CONFIRM_OPS);

      console.log(signature);
      toast.success(<ToastLink signature={signature} />, {
        id: toastId
      });

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

        {
          (!market || isLoading) ? <div className="text-center my-8">
            Loading...
          </div>
            : <div className="w-96 mx-auto">

              <h1 className="text-lg font-semibold mb-4">
                Spot Market: {decodeName(market.name)}
              </h1>

              <h1 className="text-lg font-semibold mb-4">
                Oracle Price: {price}
              </h1>

              <h1 className="text-lg font-semibold mb-4">
                Wallet Balance: {walletBalance_}
              </h1>

              <h1 className="text-lg font-semibold mb-4">
                Vault Balance: {vaultBalance_}
              </h1>

              <div className="w-full flex flex-col gap-6 my-4">

                <div className="w-full flex flex-col gap-2">
                  <label className="text-md">Amount:</label>
                  <input type="number"
                    className="form-control text-sm text-black"
                    {...register('amount', {
                      required: true,
                      valueAsNumber: true,
                    })} />
                </div>

                <div className="flex gap-4 items-center">

                  <button type="button"
                    className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
                    onClick={handleDeposit}
                    disabled={!publicKey}>
                    Deposit
                  </button>


                  <button type="button"
                    className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
                    onClick={handleWithdraw}
                    disabled={!publicKey}>
                    Withdraw
                  </button>

                </div>

              </div>

            </div>
        }

      </form>

    </Layout>
  );
}
