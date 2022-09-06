use crate::error::ClearingHouseResult;
use crate::math::casting::cast_to_u128;
use crate::math::helpers::get_proportion_u128;
use crate::math_error;
use crate::state::state::FeeStructure;
use crate::state::state::OrderFillerRewardStructure;
use num_integer::Roots;
use solana_program::msg;
use std::cmp::{max, min};

use super::casting::cast_to_i128;

pub struct FillFees {
    pub user_fee: u128,
    pub maker_rebate: u128,
    pub fee_to_market: i128,
    pub fee_to_market_for_lp: i128,
    pub filler_reward: u128,
    pub referee_discount: u128,
    pub referrer_reward: u128,
}

pub fn calculate_fee_for_order_fulfill_against_amm(
    quote_asset_amount: u128,
    fee_structure: &FeeStructure,
    order_ts: i64,
    now: i64,
    reward_filler: bool,
    reward_referrer: bool,
    quote_asset_amount_surplus: i128,
    is_post_only: bool,
) -> ClearingHouseResult<FillFees> {
    // if there was a quote_asset_amount_surplus, the order was a maker order and fee_to_market comes from surplus
    if is_post_only {
        let fee = cast_to_u128(quote_asset_amount_surplus)?;
        let filler_reward: u128 = if !reward_filler {
            0
        } else {
            calculate_filler_reward(fee, order_ts, now, &fee_structure.filler_reward_structure)?
        };
        let fee_to_market =
            cast_to_i128(fee.checked_sub(filler_reward).ok_or_else(math_error!())?)?;
        let user_fee = 0_u128;

        Ok(FillFees {
            user_fee,
            maker_rebate: 0,
            fee_to_market,
            fee_to_market_for_lp: 0,
            filler_reward,
            referee_discount: 0,
            referrer_reward: 0,
        })
    } else {
        let fee = quote_asset_amount
            .checked_mul(fee_structure.fee_numerator)
            .ok_or_else(math_error!())?
            .checked_div(fee_structure.fee_denominator)
            .ok_or_else(math_error!())?;

        let (referrer_reward, referee_discount) = if reward_referrer {
            calculate_referrer_reward_and_referee_discount(fee, fee_structure)?
        } else {
            (0, 0)
        };

        let user_fee = fee
            .checked_sub(referee_discount)
            .ok_or_else(math_error!())?;

        let filler_reward: u128 = if !reward_filler {
            0
        } else {
            calculate_filler_reward(fee, order_ts, now, &fee_structure.filler_reward_structure)?
        };

        let fee_to_market = cast_to_i128(
            user_fee
                .checked_sub(filler_reward)
                .ok_or_else(math_error!())?
                .checked_sub(referrer_reward)
                .ok_or_else(math_error!())?,
        )?
        .checked_add(quote_asset_amount_surplus)
        .ok_or_else(math_error!())?;

        let fee_to_market_for_lp = fee_to_market
            .checked_sub(quote_asset_amount_surplus)
            .ok_or_else(math_error!())?;

        Ok(FillFees {
            user_fee,
            maker_rebate: 0,
            fee_to_market,
            fee_to_market_for_lp,
            filler_reward,
            referee_discount,
            referrer_reward,
        })
    }
}

fn calculate_referrer_reward_and_referee_discount(
    fee: u128,
    fee_structure: &FeeStructure,
) -> ClearingHouseResult<(u128, u128)> {
    Ok((
        get_proportion_u128(
            fee,
            fee_structure.referral_discount.referrer_reward_numerator,
            fee_structure.referral_discount.referrer_reward_denominator,
        )?,
        get_proportion_u128(
            fee,
            fee_structure.referral_discount.referee_discount_numerator,
            fee_structure.referral_discount.referee_discount_denominator,
        )?,
    ))
}

fn calculate_filler_reward(
    fee: u128,
    order_ts: i64,
    now: i64,
    filler_reward_structure: &OrderFillerRewardStructure,
) -> ClearingHouseResult<u128> {
    // incentivize keepers to prioritize filling older orders (rather than just largest orders)
    // for sufficiently small-sized order, reward based on fraction of fee paid

    let size_filler_reward = fee
        .checked_mul(filler_reward_structure.reward_numerator)
        .ok_or_else(math_error!())?
        .checked_div(filler_reward_structure.reward_denominator)
        .ok_or_else(math_error!())?;

    let min_time_filler_reward = filler_reward_structure.time_based_reward_lower_bound;
    let time_since_order = max(
        1,
        cast_to_u128(now.checked_sub(order_ts).ok_or_else(math_error!())?)?,
    );
    let time_filler_reward = time_since_order
        .checked_mul(100_000_000) // 1e8
        .ok_or_else(math_error!())?
        .nth_root(4)
        .checked_mul(min_time_filler_reward)
        .ok_or_else(math_error!())?
        .checked_div(100) // 1e2 = sqrt(sqrt(1e8))
        .ok_or_else(math_error!())?;

    // lesser of size-based and time-based reward
    let fee = min(size_filler_reward, time_filler_reward);

    Ok(fee)
}

pub fn calculate_fee_for_fulfillment_with_match(
    quote_asset_amount: u128,
    fee_structure: &FeeStructure,
    order_ts: i64,
    now: i64,
    reward_filler: bool,
    reward_referrer: bool,
) -> ClearingHouseResult<FillFees> {
    let fee = quote_asset_amount
        .checked_mul(fee_structure.fee_numerator)
        .ok_or_else(math_error!())?
        .checked_div(fee_structure.fee_denominator)
        .ok_or_else(math_error!())?;

    let maker_rebate = fee
        .checked_mul(fee_structure.maker_rebate_numerator)
        .ok_or_else(math_error!())?
        .checked_div(fee_structure.maker_rebate_denominator)
        .ok_or_else(math_error!())?;

    let (referrer_reward, referee_discount) = if reward_referrer {
        calculate_referrer_reward_and_referee_discount(fee, fee_structure)?
    } else {
        (0, 0)
    };

    let taker_fee = fee
        .checked_sub(referee_discount)
        .ok_or_else(math_error!())?;

    let filler_reward: u128 = if !reward_filler {
        0
    } else {
        calculate_filler_reward(fee, order_ts, now, &fee_structure.filler_reward_structure)?
    };

    // must be non-negative
    let fee_to_market = cast_to_i128(
        taker_fee
            .checked_sub(filler_reward)
            .ok_or_else(math_error!())?
            .checked_sub(referrer_reward)
            .ok_or_else(math_error!())?
            .checked_sub(maker_rebate)
            .ok_or_else(math_error!())?,
    )?;

    Ok(FillFees {
        user_fee: taker_fee,
        maker_rebate,
        fee_to_market,
        filler_reward,
        referee_discount,
        referrer_reward,
        fee_to_market_for_lp: 0,
    })
}

pub struct SerumFillFees {
    pub user_fee: u128,
    pub fee_to_market: u128,
    pub fee_pool_delta: i128,
    pub filler_reward: u128,
}

pub fn calculate_fee_for_fulfillment_with_serum(
    quote_asset_amount: u128,
    fee_structure: &FeeStructure,
    order_ts: i64,
    now: i64,
    reward_filler: bool,
    serum_fee: u128,
    serum_referrer_rebate: u128,
    fee_pool_amount: u128,
) -> ClearingHouseResult<SerumFillFees> {
    let fee = quote_asset_amount
        .checked_mul(fee_structure.fee_numerator)
        .ok_or_else(math_error!())?
        .checked_div(fee_structure.fee_denominator)
        .ok_or_else(math_error!())?;

    let serum_fee_plus_referrer_rebate = serum_fee
        .checked_add(serum_referrer_rebate)
        .ok_or_else(math_error!())?;

    let user_fee = fee.max(serum_fee_plus_referrer_rebate);

    let filler_reward = if reward_filler {
        let user_fee_available = user_fee
            .checked_sub(serum_fee_plus_referrer_rebate)
            .ok_or_else(math_error!())?;

        // can only pay the filler immediately if
        // 1. there are fees already in the fee pool
        // 2. the user_fee is greater than the serum_fee_plus_referrer_rebate
        let available_fee = user_fee_available.max(fee_pool_amount);

        calculate_filler_reward(
            user_fee,
            order_ts,
            now,
            &fee_structure.filler_reward_structure,
        )?
        .min(available_fee)
    } else {
        0
    };

    let fee_to_market = user_fee
        .checked_sub(serum_fee)
        .ok_or_else(math_error!())?
        .checked_sub(filler_reward)
        .ok_or_else(math_error!())?;

    let fee_pool_delta = cast_to_i128(fee_to_market)?
        .checked_sub(cast_to_i128(serum_referrer_rebate)?)
        .ok_or_else(math_error!())?;

    Ok(SerumFillFees {
        user_fee,
        fee_to_market,
        filler_reward,
        fee_pool_delta,
    })
}

#[cfg(test)]
mod test {

    mod calculate_fee_for_taker_and_maker {
        use crate::math::constants::QUOTE_PRECISION;
        use crate::math::fees::{calculate_fee_for_fulfillment_with_match, FillFees};
        use crate::state::state::{FeeStructure, ReferralDiscount};

        #[test]
        fn no_filler() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let FillFees {
                user_fee: taker_fee,
                maker_rebate,
                fee_to_market,
                filler_reward,
                referee_discount,
                referrer_reward,
                ..
            } = calculate_fee_for_fulfillment_with_match(
                quote_asset_amount,
                &FeeStructure::default(),
                0,
                0,
                false,
                false,
            )
            .unwrap();

            assert_eq!(taker_fee, 100000);
            assert_eq!(maker_rebate, 60000);
            assert_eq!(fee_to_market, 40000);
            assert_eq!(filler_reward, 0);
            assert_eq!(referrer_reward, 0);
            assert_eq!(referee_discount, 0);
        }

        #[test]
        fn filler_size_reward() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let mut fee_structure = FeeStructure::default();
            fee_structure
                .filler_reward_structure
                .time_based_reward_lower_bound = 10000000000000000; // big number

            let FillFees {
                user_fee: taker_fee,
                maker_rebate,
                fee_to_market,
                filler_reward,
                referee_discount,
                referrer_reward,
                ..
            } = calculate_fee_for_fulfillment_with_match(
                quote_asset_amount,
                &fee_structure,
                0,
                0,
                true,
                false,
            )
            .unwrap();

            assert_eq!(taker_fee, 100000);
            assert_eq!(maker_rebate, 60000);
            assert_eq!(fee_to_market, 30000);
            assert_eq!(filler_reward, 10000);
            assert_eq!(referrer_reward, 0);
            assert_eq!(referee_discount, 0);
        }

        #[test]
        fn time_reward_no_time_passed() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let mut fee_structure = FeeStructure::default();
            fee_structure.filler_reward_structure.reward_numerator = 1; // will make size reward the whole fee
            fee_structure.filler_reward_structure.reward_denominator = 1;

            let FillFees {
                user_fee: taker_fee,
                maker_rebate,
                fee_to_market,
                filler_reward,
                referee_discount,
                referrer_reward,
                ..
            } = calculate_fee_for_fulfillment_with_match(
                quote_asset_amount,
                &fee_structure,
                0,
                0,
                true,
                false,
            )
            .unwrap();

            assert_eq!(taker_fee, 100000);
            assert_eq!(maker_rebate, 60000);
            assert_eq!(fee_to_market, 30000);
            assert_eq!(filler_reward, 10000);
            assert_eq!(referrer_reward, 0);
            assert_eq!(referee_discount, 0);
        }

        #[test]
        fn time_reward_time_passed() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let mut fee_structure = FeeStructure::default();
            fee_structure.filler_reward_structure.reward_numerator = 1; // will make size reward the whole fee
            fee_structure.filler_reward_structure.reward_denominator = 1;

            let FillFees {
                user_fee: taker_fee,
                maker_rebate,
                fee_to_market,
                filler_reward,
                referee_discount,
                referrer_reward,
                ..
            } = calculate_fee_for_fulfillment_with_match(
                quote_asset_amount,
                &fee_structure,
                0,
                60,
                true,
                false,
            )
            .unwrap();

            assert_eq!(taker_fee, 100000);
            assert_eq!(maker_rebate, 60000);
            assert_eq!(fee_to_market, 12200);
            assert_eq!(filler_reward, 27800);
            assert_eq!(referrer_reward, 0);
            assert_eq!(referee_discount, 0);
        }

        #[test]
        fn referrer() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let fee_structure = FeeStructure {
                referral_discount: ReferralDiscount {
                    referrer_reward_numerator: 1,
                    referrer_reward_denominator: 10,
                    referee_discount_numerator: 1,
                    referee_discount_denominator: 10,
                },
                ..FeeStructure::default()
            };

            let FillFees {
                user_fee: taker_fee,
                maker_rebate,
                fee_to_market,
                filler_reward,
                referee_discount,
                referrer_reward,
                ..
            } = calculate_fee_for_fulfillment_with_match(
                quote_asset_amount,
                &fee_structure,
                0,
                0,
                false,
                true,
            )
            .unwrap();

            assert_eq!(taker_fee, 90000);
            assert_eq!(maker_rebate, 60000);
            assert_eq!(fee_to_market, 20000);
            assert_eq!(filler_reward, 0);
            assert_eq!(referrer_reward, 10000);
            assert_eq!(referee_discount, 10000);
        }
    }

    mod calculate_fee_for_order_fulfill_against_amm {
        use crate::math::constants::QUOTE_PRECISION;
        use crate::math::fees::{calculate_fee_for_order_fulfill_against_amm, FillFees};
        use crate::state::state::{FeeStructure, ReferralDiscount};

        #[test]
        fn referrer() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let fee_structure = FeeStructure {
                referral_discount: ReferralDiscount {
                    referrer_reward_numerator: 1,
                    referrer_reward_denominator: 10,
                    referee_discount_numerator: 1,
                    referee_discount_denominator: 10,
                },
                ..FeeStructure::default()
            };

            let FillFees {
                user_fee,
                fee_to_market,
                filler_reward,
                referee_discount,
                referrer_reward,
                ..
            } = calculate_fee_for_order_fulfill_against_amm(
                quote_asset_amount,
                &fee_structure,
                0,
                60,
                false,
                true,
                0,
                false,
            )
            .unwrap();

            assert_eq!(user_fee, 90000);
            assert_eq!(fee_to_market, 80000);
            assert_eq!(filler_reward, 0);
            assert_eq!(referrer_reward, 10000);
            assert_eq!(referee_discount, 10000);
        }
    }

    mod calculate_fee_for_fulfillment_with_serum {
        use crate::math::constants::QUOTE_PRECISION;
        use crate::math::fees::{calculate_fee_for_fulfillment_with_serum, SerumFillFees};
        use crate::state::state::FeeStructure;

        #[test]
        fn no_filler() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let serum_fee = 32000_u128; // 3.2 bps

            let serum_referrer_rebate = 8000_u128; // .8 bps

            let fee_pool_token_amount = 0_u128;

            let fee_structure = FeeStructure::default();

            let SerumFillFees {
                user_fee,
                fee_to_market,
                fee_pool_delta,
                filler_reward,
            } = calculate_fee_for_fulfillment_with_serum(
                quote_asset_amount,
                &fee_structure,
                0,
                0,
                false,
                serum_fee,
                serum_referrer_rebate,
                fee_pool_token_amount,
            )
            .unwrap();

            assert_eq!(user_fee, 100000);
            assert_eq!(fee_to_market, 68000);
            assert_eq!(fee_pool_delta, 60000);
            assert_eq!(filler_reward, 0);
        }

        #[test]
        fn filler_reward_from_excess_user_fee() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let serum_fee = 32000_u128; // 3.2 bps

            let serum_referrer_rebate = 8000_u128; // .8 bps

            let fee_pool_token_amount = 0_u128;

            let fee_structure = FeeStructure::default();

            let SerumFillFees {
                user_fee,
                fee_to_market,
                fee_pool_delta,
                filler_reward,
            } = calculate_fee_for_fulfillment_with_serum(
                quote_asset_amount,
                &fee_structure,
                0,
                0,
                true,
                serum_fee,
                serum_referrer_rebate,
                fee_pool_token_amount,
            )
            .unwrap();

            assert_eq!(user_fee, 100000);
            assert_eq!(fee_to_market, 58000);
            assert_eq!(fee_pool_delta, 50000);
            assert_eq!(filler_reward, 10000);
        }

        #[test]
        fn filler_reward_from_fee_pool() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let serum_fee = 32000_u128; // 3.2 bps

            let serum_referrer_rebate = 8000_u128; // .8 bps

            let fee_pool_token_amount = 10000_u128;

            let fee_structure = FeeStructure {
                fee_numerator: 4,
                fee_denominator: 10000,
                ..FeeStructure::default()
            };

            let SerumFillFees {
                user_fee,
                fee_to_market,
                fee_pool_delta,
                filler_reward,
            } = calculate_fee_for_fulfillment_with_serum(
                quote_asset_amount,
                &fee_structure,
                0,
                0,
                true,
                serum_fee,
                serum_referrer_rebate,
                fee_pool_token_amount,
            )
            .unwrap();

            assert_eq!(user_fee, 40000);
            assert_eq!(fee_to_market, 4000);
            assert_eq!(fee_pool_delta, -4000);
            assert_eq!(filler_reward, 4000);
        }

        #[test]
        fn filler_reward_from_smaller_fee_pool() {
            let quote_asset_amount = 100 * QUOTE_PRECISION;

            let serum_fee = 32000_u128; // 3.2 bps

            let serum_referrer_rebate = 8000_u128; // .8 bps

            let fee_pool_token_amount = 2000_u128;

            let fee_structure = FeeStructure {
                fee_numerator: 4,
                fee_denominator: 10000,
                ..FeeStructure::default()
            };

            let SerumFillFees {
                user_fee,
                fee_to_market,
                fee_pool_delta,
                filler_reward,
            } = calculate_fee_for_fulfillment_with_serum(
                quote_asset_amount,
                &fee_structure,
                0,
                0,
                true,
                serum_fee,
                serum_referrer_rebate,
                fee_pool_token_amount,
            )
            .unwrap();

            assert_eq!(user_fee, 40000);
            assert_eq!(fee_to_market, 6000);
            assert_eq!(fee_pool_delta, -2000);
            assert_eq!(filler_reward, 2000);
        }
    }
}
