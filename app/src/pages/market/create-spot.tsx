import Layout from "@/components/Layout";
import { useForm } from "react-hook-form";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useDriftProgram } from "@/hooks/useDriftProgram";
import toast from "react-hot-toast";
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import ToastLink from "@/components/ToastLink";
import BN from "bn.js";
import { AssetTier, OracleSource } from "@/modules/types";
import { ONE, SPOT_MARKET_RATE_PRECISION, SPOT_MARKET_WEIGHT_PRECISION, PRICE_PRECISION, ZERO, CONFIRM_OPS } from "@/constants";
import { shortenPubkey, encodeName, getDriftSignerPublicKey, getDriftStateAccountPublicKey, getInsuranceFundVaultPublicKey, getSpotMarketPublicKey, getSpotMarketVaultPublicKey } from "@/modules";
import {
  NATIVE_MINT,
} from '@solana/spl-token';
import { useGlobalStore, useMarketStore } from "@/stores";

type CreateMarketArgs = {
  name: string;
  mint: string;
  oracleSource: string;
  oracleAddress: string;
}

export default function CreateMarket() {
  const { state } = useGlobalStore();
  const { fetchSpotMarkets } = useMarketStore();

  const { publicKey } = useWallet();
  const program = useDriftProgram();

  const { register, handleSubmit } = useForm<CreateMarketArgs>({
    defaultValues: {
      name: "Market",
      mint: NATIVE_MINT.toBase58(),
      oracleSource: 'pyth',
      oracleAddress: PublicKey.default.toBase58()
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

    const mint = new PublicKey(data.mint);

    const admin = state.admin;
    if (admin.toBase58() != publicKey.toBase58()) {
      toast.error(`You need to connect ${shortenPubkey(admin.toBase58())} wallet`);
      return;
    }

    const statePda = getDriftStateAccountPublicKey();
    const marketIndex = state.numberOfSpotMarkets;

    const spotMarket = getSpotMarketPublicKey(marketIndex);
    const spotMarketVault = getSpotMarketVaultPublicKey(marketIndex);
    const insuranceFundVault = getInsuranceFundVaultPublicKey(marketIndex);
    const driftSigner = getDriftSignerPublicKey();

    let oracleSource: OracleSource = OracleSource.QUOTE_ASSET;
    if (data.oracleSource == "pyth") {
      oracleSource = OracleSource.PYTH;
    }
    else if (data.oracleSource == "pyth-pull") {
      oracleSource = OracleSource.PYTH_PULL;
    }
    else if (data.oracleSource == "switchboard") {
      oracleSource = OracleSource.SWITCHBOARD;
    }
    else if (data.oracleSource == "switchboard-ondemand") {
      oracleSource = OracleSource.SWITCHBOARD_ON_DEMAND;
    }

    const priceOracle = marketIndex == 0 ? PublicKey.default : new PublicKey(data.oracleAddress);

    const nameBuffer = encodeName(data.name);

    // Default values for create market
    const optimalUtilization = SPOT_MARKET_RATE_PRECISION.div(
      new BN(2)
    ).toNumber(); // 50% utilization

    let optimalRate, maxRate, initialAssetWeight, maintenanceAssetWeight, initialLiabilityWeight, maintenanceLiabilityWeight;
    if (oracleSource == OracleSource.QUOTE_ASSET) {
      optimalRate = SPOT_MARKET_RATE_PRECISION.toNumber();
      maxRate = SPOT_MARKET_RATE_PRECISION.toNumber();
      initialAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber();
      maintenanceAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber();
      initialLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber();
      maintenanceLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber();
    }
    else {
      optimalRate = SPOT_MARKET_RATE_PRECISION.mul(new BN(20)).toNumber(); // 2000% APR
      maxRate = SPOT_MARKET_RATE_PRECISION.mul(new BN(50)).toNumber(); // 5000% APR
      initialAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.mul(new BN(8))
        .div(new BN(10))
        .toNumber();
      maintenanceAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.mul(new BN(9))
        .div(new BN(10))
        .toNumber();
      initialLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.mul(new BN(12))
        .div(new BN(10))
        .toNumber();
      maintenanceLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.mul(
        new BN(11)
      )
        .div(new BN(10))
        .toNumber();
    }

    const imfFactor = 0;
    const liquidatorFee = 0;
    const ifLiquidationFee = 0;
    const activeStatus = true;
    const assetTier = AssetTier.COLLATERAL;
    const scaleInitialAssetWeightStart = ZERO;
    const withdrawGuardThreshold = ZERO;
    const orderTickSize = ONE;
    const orderStepSize = ONE;
    const ifTotalFactor = 0;

    const toastId = toast.loading("Processing...");

    try {
      const signature = await program.methods.initializeSpotMarket(
        optimalUtilization,
        optimalRate,
        maxRate,
        oracleSource as any,
        initialAssetWeight,
        maintenanceAssetWeight,
        initialLiabilityWeight,
        maintenanceLiabilityWeight,
        imfFactor,
        liquidatorFee,
        ifLiquidationFee,
        activeStatus,
        assetTier,
        scaleInitialAssetWeightStart,
        withdrawGuardThreshold,
        orderTickSize,
        orderStepSize,
        ifTotalFactor,
        nameBuffer,
      )
        .accounts({
          state: statePda,
          admin,
          oracle: priceOracle,
          spotMarket,
          spotMarketMint: mint,
          spotMarketVault,
          insuranceFundVault,
          driftSigner,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000_000
          }),
        ])
        .rpc(CONFIRM_OPS);

      await fetchSpotMarkets();

      console.log(signature);
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
            Create Spot Market
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
              <label className="text-md">Mint</label>
              <select className="text-black"
                {...register('mint', {
                  required: true
                })}>
                <option value={undefined}>--- Select ---</option>
                <option value={'8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2'}>USDC</option>
                <option value={'3BZPwbcqB5kKScF3TEXxwNfx5ipV13kbRVDvfVp5c6fv'}>BTC</option>
                <option value={'GLfF72ZCUnS6N9iDJw8kedHzd6WFVf3VbpwdKKy76FRk'}>PYUSD</option>
                <option value={'So11111111111111111111111111111111111111112'}>WSOL</option>
              </select>
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Oracle Source</label>
              <select className="text-black"
                {...register('oracleSource', {
                  required: true
                })}>
                <option value={undefined}>--- Select ---</option>
                <option value={'pyth'}>Pyth</option>
                <option value={'pyth-pull'}>Pyth Pull</option>
                <option value={'switchboard'}>Switchboard</option>
                <option value={'switchboard-ondemand'}>Switchboard on-demand</option>
                <option value={'quote-asset'}>Quote asset</option>
              </select>
            </div>

            <div className="w-full flex flex-col gap-2">
              <label className="text-md">Oracle Address</label>
              <input type="text"
                className="form-control text-sm text-black"
                {...register('oracleAddress', {
                  required: true,
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
