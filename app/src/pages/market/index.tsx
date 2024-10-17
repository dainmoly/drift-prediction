import Layout from "@/components/Layout";
import ToastLink from "@/components/ToastLink";
import { useDriftProgram } from "@/hooks/useDriftProgram";
import { BASE_PRECISION, CONFIRM_OPS, QUOTE_SPOT_MARKET_INDEX } from "@/constants";
import { useGlobalStore, useMarketStore, useUserStore } from "@/stores";
import { useWallet } from "@solana/wallet-adapter-react";
import { AccountMeta, ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import Link from "next/link";
import toast from "react-hot-toast";

import { getVariant, isVariant, PerpMarketAccount, unifyArray, decodeName, getDriftStateAccountPublicKey, getTokenMint, getUserAccountPublicKey, getUserStatsAccountPublicKey, shortenPubkey, MarketStatus, getRemainAccountsForPlaceOrder, getRemainAccounts } from "@/modules";
import { BN } from "bn.js";


export default function Home() {
  const { state, fetchState } = useGlobalStore();
  const { perpMarkets, spotMarkets, fetchPerpMarkets } = useMarketStore();
  const { users } = useUserStore();

  const { publicKey } = useWallet();
  const program = useDriftProgram();

  const handleUpdatePerpOracle = async (market: PerpMarketAccount) => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state) {
      toast.error("You need to initialize the state account first");
      return;
    }

    if (!market) {
      toast.error("Market not found");
      return;
    }

    const userStats = getUserStatsAccountPublicKey(publicKey);

    const toastId = toast.loading("Processing...");

    try {
      const statePda = getDriftStateAccountPublicKey();

      let userPubkeys: string[] = [];
      for (const user of users) {
        for (const t of user.orders) {
          if (isVariant(t.status, "open") && isVariant(t.marketType, "perp") && t.marketIndex == market.marketIndex) {
            userPubkeys.push(user.authority.toBase58());
          }
        }
      }

      let remainingAccounts: AccountMeta[] = [];
      userPubkeys = unifyArray(userPubkeys);
      for (const user of userPubkeys) {
        remainingAccounts.push({
          pubkey: getUserAccountPublicKey(new PublicKey(user)),
          isWritable: true,
          isSigner: false,
        });
        remainingAccounts.push({
          pubkey: getUserStatsAccountPublicKey(new PublicKey(user)),
          isWritable: true,
          isSigner: false,
        });
      }

      const updateOracleIx = await program.methods.updatePrelaunchOracle()
        .accounts({
          state: statePda,
          perpMarket: market.pubkey,
          oracle: market.amm.oracle,
        })
        .instruction();

      let signature = await program.methods.updatePerpBidAskTwap()
        .accounts({
          state: statePda,
          perpMarket: market.pubkey,
          oracle: market.amm.oracle,
          authority: publicKey,
          keeperStats: userStats
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
        ])
        .postInstructions([
          updateOracleIx
        ])
        .rpc(CONFIRM_OPS);

      console.log(signature)

      toast.success(<ToastLink signature={signature} />, {
        id: toastId
      });
    } catch (ex) {
      console.log(ex);
      toast.error((ex as Error).message, {
        id: toastId
      });
    }
  }

  const handleDeletePerpMarket = async (market: PerpMarketAccount) => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state) {
      toast.error("You need to initialize the state account first");
      return;
    }

    if (!market) {
      toast.error("Market not found");
      return;
    }

    const admin = state.admin;
    if (admin.toBase58() != publicKey.toBase58()) {
      toast.error(`You need to connect ${shortenPubkey(admin.toBase58())} wallet`);
      return;
    }

    const toastId = toast.loading("Processing...");

    try {
      const statePda = getDriftStateAccountPublicKey();

      let signature = await program.methods.deleteInitializedPerpMarket(
        market.marketIndex
      )
        .accounts({
          state: statePda,
          admin: publicKey,
          perpMarket: market.pubkey,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
        ])
        .rpc(CONFIRM_OPS);

      console.log(signature)

      await Promise.all([
        fetchPerpMarkets(),
        fetchState()
      ]);

      toast.success(<ToastLink signature={signature} />, {
        id: toastId
      });
    } catch (ex) {
      console.log(ex);
      toast.error((ex as Error).message, {
        id: toastId
      });
    }
  }

  const handleUpdateExpiry = async (market: PerpMarketAccount) => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state) {
      toast.error("You need to initialize the state account first");
      return;
    }

    if (!market) {
      toast.error("Market not found");
      return;
    }

    const admin = state.admin;
    if (admin.toBase58() != publicKey.toBase58()) {
      toast.error(`You need to connect ${shortenPubkey(admin.toBase58())} wallet`);
      return;
    }

    const toastId = toast.loading("Processing...");

    const price = new BN(1);
    const maxPrice = new BN(2);

    try {
      const statePda = getDriftStateAccountPublicKey();

      const updateOracleIx = await program.methods.updatePrelaunchOracleParams({
        perpMarketIndex: market.marketIndex,
        price,
        maxPrice,
      }).accounts({
        admin,
        state: statePda,
        perpMarket: market.pubkey,
        prelaunchOracle: market.amm.oracle,
      }).instruction();

      const updateTwapIx = await program.methods.updatePerpMarketAmmOracleTwap()
        .accounts({
          admin,
          state: statePda,
          perpMarket: market.pubkey,
          oracle: market.amm.oracle,
        }).instruction();

      const remainingAccounts = getRemainAccounts(
        [],
        [market],
        spotMarkets.filter(t => t.marketIndex == QUOTE_SPOT_MARKET_INDEX) ?? []
      );

      const expiryTs = new BN(Math.floor(new Date().getTime() / 1000) + 30);
      const signature = await program.methods.updatePerpMarketExpiry(
        expiryTs
      ).accounts({
        admin,
        state: statePda,
        perpMarket: market.pubkey
      })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
          updateOracleIx,
          updateTwapIx,
        ])
        .remainingAccounts(remainingAccounts)
        .rpc(CONFIRM_OPS);

      console.log(signature)

      await Promise.all([
        fetchPerpMarkets(),
        fetchState()
      ]);

      toast.success(<ToastLink signature={signature} />, {
        id: toastId
      });
    } catch (ex) {
      console.log(ex);
      toast.error((ex as Error).message, {
        id: toastId
      });
    }
  }

  const handleResolvePerp = async (market: PerpMarketAccount) => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state) {
      toast.error("You need to initialize the state account first");
      return;
    }

    if (!market) {
      toast.error("Market not found");
      return;
    }

    const admin = state.admin;
    if (admin.toBase58() != publicKey.toBase58()) {
      toast.error(`You need to connect ${shortenPubkey(admin.toBase58())} wallet`);
      return;
    }

    const toastId = toast.loading("Processing...");

    const price = new BN(1);
    const maxPrice = new BN(2);

    try {
      const statePda = getDriftStateAccountPublicKey();

      const updateOracleIx = await program.methods.updatePrelaunchOracleParams({
        perpMarketIndex: market.marketIndex,
        price,
        maxPrice,
      }).accounts({
        admin,
        state: statePda,
        perpMarket: market.pubkey,
        prelaunchOracle: market.amm.oracle,
      }).instruction();

      const updateTwapIx = await program.methods.updatePerpMarketAmmOracleTwap()
        .accounts({
          admin,
          state: statePda,
          perpMarket: market.pubkey,
          oracle: market.amm.oracle,
        }).instruction();

      const remainingAccounts = getRemainAccounts(
        [],
        [market],
        spotMarkets.filter(t => t.marketIndex == QUOTE_SPOT_MARKET_INDEX) ?? []
      );

      const signature = await program.methods.settleExpiredMarket(
        market.marketIndex
      ).accounts({
        admin,
        state: statePda,
        perpMarket: market.pubkey
      })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
          updateOracleIx,
          updateTwapIx,
        ])
        .remainingAccounts(remainingAccounts)
        .rpc(CONFIRM_OPS);

      console.log(signature)

      await Promise.all([
        fetchPerpMarkets(),
        fetchState()
      ]);

      toast.success(<ToastLink signature={signature} />, {
        id: toastId
      });
    } catch (ex) {
      console.log(ex);
      toast.error((ex as Error).message, {
        id: toastId
      });
    }
  }

  return (
    <Layout>
      <div className="mb-8">

        <div className="flex justify-between items-center mt-4 mb-4">

          <div className="text-lg">
            Perp Markets
          </div>

          <div className="flex gap-2">
            <Link href={'/market/create-perp'}>
              <button type="button"
                className="w-fit rounded-md bg-gray-900 text-white px-3 py-2 disabled:opacity-50">
                Add a market
              </button>
            </Link>
          </div>

        </div>

        <table className="table table-auto w-full">
          <thead>
            <tr className="border-b border-gray-500">
              <th className="text-left p-2">
                Market Index
              </th>
              <th className="text-left p-2">
                Name
              </th>
              <th className="text-left p-2">
                Base B.
              </th>
              <th className="text-left p-2">
                Quote B.
              </th>
              <th className="text-left p-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {
              perpMarkets.map((market, idx) => <tr key={`perp-market-${idx}`}>
                <td className="p-2">
                  {market.marketIndex}
                </td>
                <td className="p-2">
                  {decodeName(market.name)}
                </td>
                <td className="p-2">
                  {market.numberOfUsers}
                </td>
                <td className="p-2">
                  {market.amm.quoteAssetAmount.toNumber()}
                </td>
                <td className="p-2 flex gap-4">
                  <button type="button" onClick={() => handleUpdatePerpOracle(market)}>
                    Update Price
                  </button>
                  <button type="button" onClick={() => handleUpdateExpiry(market)}>
                    Update Expiry
                  </button>
                  <button type="button" onClick={() => handleResolvePerp(market)}>
                    Resolve
                  </button>
                  <Link href={`market/${market.marketIndex}/trade`}>
                    <button type="button">
                      Trade
                    </button>
                  </Link>
                  {
                    market.status == MarketStatus.INITIALIZED &&
                    <button type="button" onClick={() => handleDeletePerpMarket(market)}>
                      Delete
                    </button>
                  }
                </td>
              </tr>)
            }
          </tbody>
        </table>
      </div>

      <div className="">

        <div className="flex justify-between items-center mt-4 mb-4">

          <div className="text-lg">
            Spot Markets
          </div>

          <div className="flex gap-2">
            <Link href={'/market/create-spot'}>
              <button type="button"
                className="w-fit rounded-md bg-gray-900 text-white px-3 py-2 disabled:opacity-50">
                Add a market
              </button>
            </Link>
          </div>

        </div>

        <table className="table table-auto w-full">
          <thead>
            <tr className="border-b border-gray-500">
              <th className="text-left p-2">
                Market Index
              </th>
              <th className="text-left p-2">
                Name
              </th>
              <th className="text-left p-2">
                Mint
              </th>
              <th className="text-left p-2">
                Oracle
              </th>
              <th className="text-left p-2">
                Balance
              </th>
              <th className="text-left p-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>

            {
              spotMarkets.map((market, idx) => <tr key={`spot-market-${idx}`}>
                <td className="p-2">
                  {market.marketIndex}
                </td>
                <td className="p-2">
                  {decodeName(market.name)}
                </td>
                <td className="p-2 text-c">
                  {getTokenMint(market.mint)}
                </td>
                <td className="p-2 text-c">
                  {getVariant(market.oracleSource)}
                </td>
                <td className="p-2">
                  {(market.depositBalance.toNumber() / BASE_PRECISION.toNumber()).toFixed(2)}
                </td>
                <td className="p-2">
                  <Link href={`market/${market.marketIndex}/manage`}>
                    <button type="button">
                      Manage
                    </button>
                  </Link>
                </td>
              </tr>)
            }
          </tbody>
        </table>
      </div>

    </Layout>
  );
}
