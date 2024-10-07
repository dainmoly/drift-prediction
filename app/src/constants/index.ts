import { ConfirmOptions, PublicKey } from '@solana/web3.js';

export * from './perpMarkets';
export * from './numericConstants';
export * from './spotMarkets';

export const DRIFT_PROGRAM_ID = new PublicKey("BMVvujZpwvTKyg3VDfDm2Wjg6HvCFWcJ9Z7n6eAUB7be");
export const DRIFT_ORACLE_RECEIVER_ID = new PublicKey("G6EoTTTgpkNBtVXo96EQp2m6uwwVh2Kt6YidjkmQqoha");
export const PYTH_PROGRAM_ID = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");
export const SWITCHBOARD_PROGRAM_ID = new PublicKey("SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f");
export const SWITCHBOARD_ON_DEMAND_ID = new PublicKey("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");
export const TOKEN_FAUCET_PROGRAM_ID = new PublicKey("V4v1mQiAdLz4qwckEb45WqHYceYizoib39cDBHSWfaB");

export const USDC_MINT = new PublicKey("8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2");
export const BTC_MINT = new PublicKey("3BZPwbcqB5kKScF3TEXxwNfx5ipV13kbRVDvfVp5c6fv");
export const PYUSD_MINT = new PublicKey("GLfF72ZCUnS6N9iDJw8kedHzd6WFVf3VbpwdKKy76FRk");

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';

export const CONFIRM_OPS: ConfirmOptions = {
    maxRetries: 0,
    commitment: 'confirmed',
    skipPreflight: true,
    preflightCommitment: 'confirmed'
};
