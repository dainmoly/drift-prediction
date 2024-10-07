import Layout from "@/components/Layout";
import { useForm } from "react-hook-form";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useDriftProgram } from "@/hooks/useDriftProgram";
import toast from "react-hot-toast";
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import ToastLink from "@/components/ToastLink";
import BN from "bn.js";
import { ContractTier, OracleSource } from "@/modules/types";
import { BASE_PRECISION, BID_ASK_SPREAD_PRECISION, CONFIRM_OPS, ONE, PEG_PRECISION, PerpMarkets, PRICE_PRECISION, QUOTE_PRECISION, ZERO } from "@/constants";
import { getDriftStateAccountPublicKey, getPerpMarketPublicKey, getPrelaunchOraclePublicKey, encodeName, shortenPubkey } from "@/modules";
import { useGlobalStore, useMarketStore } from "@/stores";

type CreateMarketArgs = {
  name: string;
  baseAssetReserve: number;
  quoteAssetReserve: number;
  periodicity: number;
}

export default function CreateMarket() {

  const { state } = useGlobalStore();
  const { fetchPerpMarkets } = useMarketStore();

  const { publicKey } = useWallet();
  const program = useDriftProgram();

  const { register, handleSubmit } = useForm<CreateMarketArgs>({
    defaultValues: {
      name: "Market",
      baseAssetReserve: 1000,
      quoteAssetReserve: 1000,
      periodicity: 300, // 5min
    }
  });

  const onSubmit = async (data: CreateMarketArgs) => {
    if (!publicKey || !program) {
      toast.error("Check your wallet connection");
      return;
    }

    if (!state) {
      toast.error("You need to initialize the state account first");
      return;
    }

    const admin = state.admin;
    if (admin.toBase58() != publicKey.toBase58()) {
      toast.error(`You need to connect ${shortenPubkey(admin.toBase58())} wallet`);
      return;
    }

    const statePda = getDriftStateAccountPublicKey();
    const marketIndex = state.numberOfMarkets;

    const perpMarketPublicKey = getPerpMarketPublicKey(
      marketIndex
    );

    const oracleSource = OracleSource.Prelaunch;
    const priceOracle = getPrelaunchOraclePublicKey(marketIndex);

    const baseAssetReserve = new BN(data.baseAssetReserve).mul(BASE_PRECISION);
    const quoteAssetReserve = new BN(data.quoteAssetReserve).mul(BASE_PRECISION);
    const periodicity = new BN(data.periodicity);
    // Default values for create market
    const pegMultiplier: BN = PEG_PRECISION;
    const contractTier = ContractTier.SPECULATIVE;
    const marginRatioInitial = 10000;
    const marginRatioMaintenance = 9995;
    const liquidatorFee = 0;
    const ifLiquidatorFee = 10000;
    const imfFactor = 0;
    const activeStatus = true;
    const baseSpread = 100000;
    const maxSpread = 200000;
    const maxOpenInterest = ZERO;
    const maxRevenueWithdrawPerPeriod = ZERO;
    const quoteMaxInsurance = ZERO;
    const orderStepSize = BASE_PRECISION;
    const orderTickSize = new BN(1_000);
    const minOrderSize = BASE_PRECISION;
    const concentrationCoefScale = ONE;
    const curveUpdateIntensity = 0;
    const ammJitIntensity = 0;
    const nameBuffer = encodeName(data.name);

    const toastId = toast.loading("Processing...");

    try {
      const price = PRICE_PRECISION.divn(2);
      const maxPrice = PRICE_PRECISION;
      const initOracleIx = await program.methods.initializePrelaunchOracle({
        perpMarketIndex: marketIndex,
        price,
        maxPrice,
      })
        .accounts({
          admin,
          state: statePda,
          prelaunchOracle: priceOracle,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        }).instruction();

      const updateOracleIx = await program.methods.updatePerpMarketBaseSpread(
        BID_ASK_SPREAD_PRECISION.divn(50).toNumber(),
      )
        .accounts({
          admin,
          state: statePda,
          perpMarket: perpMarketPublicKey
        }).instruction();

      const signature = await program.methods.initializePerpMarket(
        marketIndex,
        baseAssetReserve,
        quoteAssetReserve,
        periodicity,
        pegMultiplier,
        oracleSource,
        contractTier,
        marginRatioInitial,
        marginRatioMaintenance,
        liquidatorFee,
        ifLiquidatorFee,
        imfFactor,
        activeStatus,
        baseSpread,
        maxSpread,
        maxOpenInterest,
        maxRevenueWithdrawPerPeriod,
        quoteMaxInsurance,
        orderStepSize,
        orderTickSize,
        minOrderSize,
        concentrationCoefScale,
        curveUpdateIntensity,
        ammJitIntensity,
        nameBuffer
      )
        .accounts({
          state: statePda,
          admin,
          oracle: priceOracle,
          perpMarket: perpMarketPublicKey,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
          initOracleIx,
        ])
        .postInstructions([
          // updateOracleIx,
        ])
        .rpc(CONFIRM_OPS);

      console.log(signature);

      await fetchPerpMarkets();
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

        <div className="w-96 mx-auto">

          <h1 className="text-lg font-semibold">
            Create Perp Market
          </h1>

          <div className="w-full flex flex-col gap-6 my-4">

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Market Name</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('name', {
                  required: true
                })} />
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Base Asset Reserve</label>
              <input type="number"
                className="form-control text-sm text-black"
                {...register('baseAssetReserve', {
                  required: true,
                  valueAsNumber: true
                })} />
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Quote Asset Reserve</label>
              <input type="number"
                className="form-control text-sm text-black"
                {...register('quoteAssetReserve', {
                  required: true,
                  valueAsNumber: true
                })} />
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Periodicity (unit: sec)</label>
              <input type="number"
                className="form-control text-sm text-black"
                {...register('periodicity', {
                  required: true,
                  valueAsNumber: true
                })} />
            </div>

            <button type="submit"
              className="w-full rounded-md bg-gray-900 text-white p-3 disabled:opacity-50"
              disabled={!publicKey}>
              Create Market
            </button>

          </div>

        </div>

      </form>

    </Layout>
  );
}
