import { useForm } from "react-hook-form";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { AccountMeta, ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import BN from "bn.js";
import { useRouter } from "next/router";

import { useDriftProgram } from "@/hooks/useDriftProgram";
import Layout from "@/components/Layout";
import ToastLink from "@/components/ToastLink";
import { BASE_PRECISION, CONFIRM_OPS, PRICE_PRECISION, QUOTE_PRECISION, QUOTE_SPOT_MARKET_INDEX } from "@/constants";
import { useGlobalStore, useMarketStore, useUserStore } from "@/stores";
import { getOracleClient } from "@/modules/oracles/oracleClient";
import { shortenPubkey, unifyArray, decodeName, getDriftStateAccountPublicKey, getOrderParams, getPerpMarketPublicKey, getSpotMarketPublicKey, getSpotMarketVaultPublicKey, getUserAccountPublicKey, getUserStatsAccountPublicKey, isVariant, OptionalOrderParams, Order, OrderType, PositionDirection, getMarketOrderParams, getLimitOrderParams, PerpPosition, getRemainAccountsForPlaceOrder } from "@/modules";

type TradeShareArgs = {
  type: 'market' | 'limit';
  option: 'long' | 'short';
  price: number;
  shares: number;
}

export default function Trade() {

  const router = useRouter();
  const { marketId } = router.query;

  const { state } = useGlobalStore();
  const { perpMarkets, spotMarkets } = useMarketStore();
  const { users, fetchUser, fetchAllUsers } = useUserStore();
  const [price, setPrice] = useState(0);

  const { publicKey } = useWallet();
  const program = useDriftProgram();

  const { register, watch, handleSubmit } = useForm<TradeShareArgs>({
    defaultValues: {
      type: 'market',
      option: 'long',
      price: 1,
      shares: 1,
    }
  });
  const type = watch('type');

  const market = useMemo(() => {
    const marketIdx = parseInt(marketId as string);
    const market = perpMarkets.find(t => t.marketIndex == marketIdx);
    return market;
  }, [
    marketId,
    perpMarkets,
  ])

  const user = useMemo(() => {
    if (publicKey) {
      return users.find(t => t.authority.equals(publicKey));
    }
  }, [
    users,
    publicKey,
  ])

  const orders = useMemo(() => {
    const orders: Order[] = [];

    if (market) {
      for (const user of users) {
        for (const t of user.orders) {
          if (isVariant(t.status, "open") && isVariant(t.marketType, "perp") && t.marketIndex == market.marketIndex) {
            orders.push({
              ...t,
              authority: user.authority,
            });
          }
        }
      }
    }

    return orders.sort((a, b) => {
      if (isVariant(b.direction, "long")) {
        return 1;
      }
      if (isVariant(a.direction, "long")) {
        return -1;
      }

      return a.price.sub(b.price).toNumber();
    });
  }, [
    users,
    market,
  ]);

  const positions = useMemo(() => {
    const positions: PerpPosition[] = [];

    if (market) {
      for (const user of users) {
        for (const t of user.perpPositions) {
          if (t.marketIndex == market.marketIndex && !t.baseAssetAmount.isZero()) {
            positions.push({
              ...t,
              authority: user.authority,
            });
          }
        }
      }
    }

    return positions;
  }, [
    users,
    market
  ])

  const fetchMarketPrice = async () => {
    if (!market || !program) {
      return;
    }

    const connection = program.provider.connection;
    const oracleClient = getOracleClient(market.amm.oracleSource, connection, program);
    const oracleData = await oracleClient.getOraclePriceData(market.amm.oracle);
    if (oracleData) {
      setPrice(Number(oracleData.price) / Number(PRICE_PRECISION));
    }
  }

  useEffect(() => {
    fetchMarketPrice();
  }, [
    market,
    orders
  ])

  const onSubmit = async (data: TradeShareArgs) => {
    handlePlaceOrder(data.type, data.option, data.price, data.shares, false);
  }

  const handlePlaceOrder = async (
    type: 'market' | 'limit',
    option: 'long' | 'short',
    price: number,
    amount: number,
    reduceOnly: boolean,
  ) => {

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

    if (!user) {
      toast.error("User not initialized");
      return;
    }

    const toastId = toast.loading("Processing...");

    try {
      const params: OptionalOrderParams = {
        price: type == 'market' ? new BN(0) : PRICE_PRECISION.muln(price),
        orderType: type == 'market' ? OrderType.ORACLE : OrderType.LIMIT,
        marketIndex: market.marketIndex,
        baseAssetAmount: BASE_PRECISION.muln(amount),
        direction: option == 'long' ? PositionDirection.LONG : PositionDirection.SHORT,
        reduceOnly,
        // oraclePriceOffset: 5000,
        // auctionDuration: 20,
        // auctionStartPrice: new BN(1500),
        // auctionEndPrice: new BN(3000),
      };
      const orderParams = getOrderParams(params);

      const statePda = getDriftStateAccountPublicKey();
      const userStatsPubkey = getUserStatsAccountPublicKey(publicKey);
      const userPubkey = getUserAccountPublicKey(publicKey);

      const remainingAccounts = getRemainAccountsForPlaceOrder(user, market, users, perpMarkets, spotMarkets);

      let signature;
      if (type == 'limit') {
        signature = await program.methods.placeOrders(
          [orderParams] as any,
        )
          .accounts({
            state: statePda,
            user: userPubkey,
            authority: publicKey,
          })
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 100_000_000
            }),
          ])
          .remainingAccounts(remainingAccounts)
          .rpc(CONFIRM_OPS);
      }
      else {
        signature = await program.methods.placeAndTakePerpOrder(
          orderParams as any,
          null
        )
          .accounts({
            state: statePda,
            user: userPubkey,
            userStats: userStatsPubkey,
            authority: publicKey,
          })
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 100_000_000
            }),
          ])
          .remainingAccounts(remainingAccounts)
          .rpc(CONFIRM_OPS);
      }

      await fetchAllUsers();

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

  const handleSettle = async () => {

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

    if (!user) {
      toast.error("User not initialized");
      return;
    }

    const toastId = toast.loading("Processing...");

    try {
      const statePda = getDriftStateAccountPublicKey();
      const userPubkey = getUserAccountPublicKey(publicKey);

      let remainingAccounts: AccountMeta[] = [];

      // Get open orders
      let spotIdxs: number[] = [
        market.quoteSpotMarketIndex,
      ];
      let perpIdxs: number[] = [
        market.marketIndex
      ];
      for (const position of user.spotPositions) {
        if (!position.scaledBalance.isZero()) {
          spotIdxs.push(position.marketIndex);
        }
      }
      for (const position of user.perpPositions) {
        if (!position.baseAssetAmount.isZero()) {
          perpIdxs.push(position.marketIndex);
        }
      }

      perpIdxs = unifyArray(perpIdxs);
      spotIdxs = unifyArray(spotIdxs);
      console.log(perpIdxs, spotIdxs);

      // Oracle
      for (const idx of perpIdxs) {
        remainingAccounts.push({
          pubkey: perpMarkets.find(t => t.marketIndex == idx)?.amm.oracle ?? PublicKey.default,
          isSigner: false,
          isWritable: true,
        })
      }
      for (const idx of spotIdxs) {
        if (idx != QUOTE_SPOT_MARKET_INDEX) {
          remainingAccounts.push({
            pubkey: spotMarkets.find(t => t.marketIndex == idx)?.oracle ?? PublicKey.default,
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

      let signature = await program.methods.settlePnl(
        market.marketIndex
      ).accounts({
        state: statePda,
        user: userPubkey,
        spotMarketVault: getSpotMarketVaultPublicKey(market.quoteSpotMarketIndex),
        authority: publicKey,
      })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
        ])
        .remainingAccounts(remainingAccounts)
        .rpc(CONFIRM_OPS);

      await fetchAllUsers();

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

  const handleCancelOrder = async (order: Order) => {
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

    if (!user) {
      toast.error("User not initialized");
      return;
    }

    const toastId = toast.loading("Processing...");

    try {
      const statePda = getDriftStateAccountPublicKey();
      const userStatsPubkey = getUserStatsAccountPublicKey(publicKey);
      const userPubkey = getUserAccountPublicKey(publicKey);

      let remainingAccounts: AccountMeta[] = [];

      // Get open orders
      let spotIdxs: number[] = [
        market.quoteSpotMarketIndex,
      ];
      let perpIdxs: number[] = [
        market.marketIndex
      ];
      for (const order of user.orders) {
        if (isVariant(order.status, "open")) {
          if (isVariant(order.marketType, "perp")) {
            perpIdxs.push(order.marketIndex);
          }
          else {
            spotIdxs.push(order.marketIndex);
          }
        }
      }

      perpIdxs = unifyArray(perpIdxs);
      spotIdxs = unifyArray(spotIdxs);

      // Oracle
      for (const idx of perpIdxs) {
        remainingAccounts.push({
          pubkey: perpMarkets.find(t => t.marketIndex == idx)?.amm.oracle ?? PublicKey.default,
          isSigner: false,
          isWritable: true,
        })
      }
      for (const idx of spotIdxs) {
        if (idx != QUOTE_SPOT_MARKET_INDEX) {
          remainingAccounts.push({
            pubkey: spotMarkets.find(t => t.marketIndex == idx)?.oracle ?? PublicKey.default,
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

      let signature = await program.methods.cancelOrder(
        order.orderId
      )
        .accounts({
          state: statePda,
          user: userPubkey,
          authority: publicKey,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
        ])
        .remainingAccounts(remainingAccounts)
        .rpc(CONFIRM_OPS);

      console.log(signature);

      await fetchAllUsers();

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

      <form onSubmit={handleSubmit(onSubmit)}>

        {
          !market ? <div className="text-center my-8">
            Loading...
          </div>
            :

            <div className="w-[640px] mx-auto">

              <h1 className="text-lg font-semibold mb-2">
                Prediction - {decodeName(market.name)}
              </h1>

              <h2 className="text-md font-semibold mb-2">
                Price: {price}
              </h2>


              <div className="w-full flex flex-col gap-6 my-4">

                <div className="w-full flex flex-col gap-2">
                  <label className="text-md">Yes/No</label>
                  <select className="text-black"
                    {...register('option', {
                      required: true
                    })}>
                    <option value={'long'}>Yes</option>
                    <option value={'short'}>No</option>
                  </select>
                </div>

                <div className="w-full flex flex-col gap-2">
                  <label className="text-md">Order Type</label>
                  <select className="text-black"
                    {...register('type', {
                      required: true
                    })}>
                    <option value={'market'}>Market</option>
                    <option value={'limit'}>Limit</option>
                  </select>
                </div>

                {
                  type == 'limit' ?
                    <div className="w-full flex flex-col gap-2">
                      <label className="text-md">Price</label>
                      <input type="text"
                        className="form-control text-sm text-black"
                        {...register('price', {
                          required: true,
                          valueAsNumber: true,
                        })} />
                    </div>
                    : null
                }

                <div className="w-full flex flex-col gap-2">
                  <label className="text-md">Shares</label>
                  <input type="text"
                    className="form-control text-sm text-black"
                    {...register('shares', {
                      required: true,
                      valueAsNumber: true,
                    })} />
                </div>

                <div className="flex gap-2">

                  <button type="submit"
                    className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
                    disabled={!publicKey}>
                    Place
                  </button>

                  <button type="button"
                    className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
                    onClick={handleSettle}
                    disabled={!publicKey}>
                    Settle
                  </button>

                </div>

              </div>

              <div className="w-full h-0.5 bg-black/50 my-4" />

              <p className="font-semibold my-2">
                Orderbook
              </p>

              <table className="table table-auto w-full">
                <thead>
                  <tr className="border-b border-gray-500">
                    <th className="text-left p-2">
                      Bet
                    </th>
                    <th className="text-left p-2">
                      Price
                    </th>
                    <th className="text-left p-2">
                      Amount
                    </th>
                    <th className="text-left p-2">
                      User
                    </th>
                    <th className="text-left p-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>

                  {
                    orders.map((order, idx) => <tr key={`order-${idx}`}>
                      <td className="p-2">
                        {isVariant(order.direction, "long") ? "Yes" : "No"}
                      </td>
                      <td className="p-2">
                        {order.price.toNumber() / PRICE_PRECISION.toNumber()}
                      </td>
                      <td className="p-2">
                        {order.baseAssetAmountFilled.toNumber() / BASE_PRECISION.toNumber()} / {order.baseAssetAmount.toNumber() / BASE_PRECISION.toNumber()}
                      </td>
                      <td className="p-2">
                        {shortenPubkey(order.authority?.toBase58() ?? "-")}
                      </td>
                      <td className="p-2">
                        {
                          publicKey && order.authority?.equals(publicKey) &&
                          <button type="button"
                            onClick={() => handleCancelOrder(order)}>
                            Cancel
                          </button>
                        }
                      </td>
                    </tr>)
                  }
                </tbody>
              </table>

              <div className="w-full h-0.5 bg-black/50 my-4" />

              <p className="font-semibold my-2">
                Positions
              </p>

              <table className="table table-auto w-full">
                <thead>
                  <tr className="border-b border-gray-500">
                    <th className="text-left p-2">
                      #
                    </th>
                    <th className="text-left p-2">
                      Base Amount
                    </th>
                    <th className="text-left p-2">
                      Quote Amount
                    </th>
                    <th className="text-left p-2">
                      User
                    </th>
                    <th className="text-left p-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>

                  {
                    positions.map((position, idx) => <tr key={`position-${idx}`}>
                      <td className="p-2">
                        {idx}
                      </td>
                      <td className="p-2">
                        {position.baseAssetAmount.div(BASE_PRECISION).toNumber()}
                      </td>
                      <td className="p-2">
                        {position.quoteAssetAmount.div(QUOTE_PRECISION).toNumber()}
                      </td>
                      <td className="p-2">
                        {shortenPubkey(position.authority?.toBase58() ?? "-")}
                      </td>
                      <td className="p-2">
                        {
                          publicKey && position.authority?.equals(publicKey) &&
                          <button type="button"
                            onClick={() => handlePlaceOrder('market', position.)}>
                            Cancel
                          </button>
                        }
                      </td>
                    </tr>)
                  }
                </tbody>
              </table>

            </div>
        }

      </form>

    </Layout>
  );
}
