use crate::account_loader::load;
use crate::error::{ClearingHouseResult, ErrorCode};
use crate::state::user::User;
use crate::validate;
use anchor_lang::prelude::AccountLoader;
use anchor_lang::prelude::{AccountInfo, Pubkey};
use solana_program::account_info::next_account_info;
use solana_program::msg;
use spl_token::solana_program::program_pack::{IsInitialized, Pack};
use spl_token::state::Account as TokenAccount;
use std::iter::Peekable;
use std::slice::Iter;

pub fn get_discount_token(
    expect_discount_token: bool,
    account_info_iter: &mut Peekable<Iter<AccountInfo>>,
    discount_mint: &Pubkey,
    authority_public_key: &Pubkey,
) -> ClearingHouseResult<Option<TokenAccount>> {
    let mut optional_discount_token = None;
    if expect_discount_token {
        // owner, mint and is_initialized check below, so this is a `trusted account_info`
        //#[soteria(ignore)]
        let token_account_info =
            // owner, mint and is_initialized check below, so this is a `trusted account_info`
            //#[soteria(ignore)]
            next_account_info(account_info_iter).or(Err(ErrorCode::DiscountTokenNotFound))?;

        if token_account_info.owner != &spl_token::id() {
            return Err(ErrorCode::InvalidDiscountToken);
        }

        let token_account = TokenAccount::unpack_unchecked(&token_account_info.data.borrow())
            .or(Err(ErrorCode::InvalidDiscountToken))?;

        if !token_account.is_initialized() {
            return Err(ErrorCode::InvalidDiscountToken);
        }

        if !token_account.mint.eq(discount_mint) {
            return Err(ErrorCode::InvalidDiscountToken);
        }

        if !token_account.owner.eq(authority_public_key) {
            return Err(ErrorCode::InvalidDiscountToken);
        }

        optional_discount_token = Some(token_account);
    }

    Ok(optional_discount_token)
}

pub fn get_referrer<'a, 'b, 'c, 'd>(
    expect_referrer: bool,
    account_info_iter: &'a mut Peekable<Iter<AccountInfo<'b>>>,
    user_public_key: &'c Pubkey,
    expected_referrer: Option<&'d Pubkey>,
) -> ClearingHouseResult<Option<AccountLoader<'b, User>>> {
    let mut optional_referrer = None;
    if expect_referrer {
        let referrer_account_info =
            next_account_info(account_info_iter).or(Err(ErrorCode::ReferrerNotFound))?;

        if referrer_account_info.key.eq(user_public_key) {
            return Err(ErrorCode::UserCantReferThemselves);
        }

        // in get_referrer_for_fill_order, we know who the referrer should be, so add check that the expected
        // referrer is present
        if let Some(expected_referrer) = expected_referrer {
            if !referrer_account_info.key.eq(expected_referrer) {
                return Err(ErrorCode::DidNotReceiveExpectedReferrer);
            }
        }

        let user_account: AccountLoader<User> = AccountLoader::try_from(referrer_account_info)
            .or(Err(ErrorCode::CouldNotDeserializeReferrer))?;

        optional_referrer = Some(user_account);
    }

    Ok(optional_referrer)
}

pub fn get_referrer_for_fill_order<'a, 'b, 'c>(
    account_info_iter: &'a mut Peekable<Iter<AccountInfo<'b>>>,
    user_public_key: &'c Pubkey,
    order_id: u64,
    user: &AccountLoader<User>,
) -> ClearingHouseResult<Option<AccountLoader<'b, User>>> {
    let user = &load(user)?;
    let order_index = user
        .orders
        .iter()
        .position(|order| order.order_id == order_id)
        .ok_or(ErrorCode::OrderDoesNotExist)?;
    let order = &user.orders[order_index];
    let mut referrer = None;
    if !order.referrer.eq(&Pubkey::default()) {
        referrer = get_referrer(
            true,
            account_info_iter,
            user_public_key,
            Some(&order.referrer),
        )
        .or_else(|error| match error {
            // if we can't deserialize the referrer in fill, assume user account has been deleted and dont fail
            ErrorCode::CouldNotDeserializeReferrer => Ok(None),
            // in every other case fail
            _ => Err(error),
        })?;
    }

    Ok(referrer)
}

pub fn get_maker<'a>(
    account_info_iter: &mut Peekable<Iter<AccountInfo<'a>>>,
) -> ClearingHouseResult<AccountLoader<'a, User>> {
    let maker_account_info =
        next_account_info(account_info_iter).or(Err(ErrorCode::MakerNotFound))?;

    validate!(
        maker_account_info.is_writable,
        ErrorCode::MakerMustBeWritable
    )?;

    let maker: AccountLoader<User> =
        AccountLoader::try_from(maker_account_info).or(Err(ErrorCode::CouldNotDeserializeMaker))?;

    Ok(maker)
}
