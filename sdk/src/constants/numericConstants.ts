import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '../';

export const ZERO = new BN(0);
export const ONE = new BN(1);
export const TWO = new BN(2);
export const TEN = new BN(10);
export const TEN_THOUSAND = new BN(10000);
export const BN_MAX = new BN(Number.MAX_SAFE_INTEGER);
export const TEN_MILLION = TEN_THOUSAND.mul(TEN_THOUSAND);

export const MAX_LEVERAGE = new BN(5);

export const QUOTE_PRECISION_EXP = new BN(6);
export const FUNDING_PAYMENT_PRECISION_EXP = new BN(4);
export const MARK_PRICE_PRECISION_EXP = new BN(10);
export const FUNDING_RATE_PRECISION_EXP = MARK_PRICE_PRECISION_EXP.mul(
	FUNDING_PAYMENT_PRECISION_EXP
);
export const PEG_PRECISION_EXP = new BN(3);
export const AMM_RESERVE_PRECISION_EXP = new BN(13);

export const BANK_INTEREST_PRECISION_EXP = new BN(6);
export const BANK_INTEREST_PRECISION = new BN(10).pow(
	BANK_INTEREST_PRECISION_EXP
);

export const BANK_CUMULATIVE_INTEREST_PRECISION_EXP = new BN(10);
export const BANK_CUMULATIVE_INTEREST_PRECISION = new BN(10).pow(
	BANK_CUMULATIVE_INTEREST_PRECISION_EXP
);

export const BANK_UTILIZATION_PRECISION = new BN(1000000);
export const BANK_RATE_PRECISION = new BN(1000000);
export const BANK_WEIGHT_PRECISION = new BN(100);
export const BANK_BALANCE_PRECISION_EXP = new BN(6);
export const BANK_BALANCE_PRECISION = new BN(10).pow(
	BANK_BALANCE_PRECISION_EXP
);
export const BANK_IMF_PRECISION_EXP = new BN(6);

export const BANK_IMF_PRECISION = new BN(10).pow(BANK_IMF_PRECISION_EXP);
export const LIQUIDATION_FEE_PRECISION = new BN(1000000);

export const QUOTE_PRECISION = new BN(10).pow(QUOTE_PRECISION_EXP);
export const MARK_PRICE_PRECISION = new BN(10).pow(MARK_PRICE_PRECISION_EXP);
export const FUNDING_PAYMENT_PRECISION = new BN(10).pow(
	FUNDING_PAYMENT_PRECISION_EXP
);
export const PEG_PRECISION = new BN(10).pow(PEG_PRECISION_EXP);

export const AMM_RESERVE_PRECISION = new BN(10).pow(AMM_RESERVE_PRECISION_EXP);

export const BASE_PRECISION = AMM_RESERVE_PRECISION;
export const BASE_PRECISION_EXP = AMM_RESERVE_PRECISION_EXP;

export const AMM_TO_QUOTE_PRECISION_RATIO =
	AMM_RESERVE_PRECISION.div(QUOTE_PRECISION); // 10^7
export const PRICE_DIV_PEG = MARK_PRICE_PRECISION.div(PEG_PRECISION); //10^7
export const PRICE_TO_QUOTE_PRECISION =
	MARK_PRICE_PRECISION.div(QUOTE_PRECISION);
export const AMM_TIMES_PEG_TO_QUOTE_PRECISION_RATIO =
	AMM_RESERVE_PRECISION.mul(PEG_PRECISION).div(QUOTE_PRECISION); // 10^10
export const MARGIN_PRECISION = TEN_THOUSAND;
export const BID_ASK_SPREAD_PRECISION = new BN(1000000);

export const ONE_YEAR = new BN(31536000);

export const QUOTE_ASSET_BANK_INDEX = new BN(0);

export const LAMPORTS_PRECISION = new BN(LAMPORTS_PER_SOL);
export const LAMPORTS_EXP = new BN(Math.log10(LAMPORTS_PER_SOL));
