import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { DRIFT_PROGRAM_ID } from '@/constants';

export function getDriftStateAccountPublicKeyAndNonce(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(anchor.utils.bytes.utf8.encode('drift_state'))],
    DRIFT_PROGRAM_ID
  );
}

export function getDriftStateAccountPublicKey(): PublicKey {
  return getDriftStateAccountPublicKeyAndNonce()[0];
}

export function getUserAccountPublicKeyAndNonce(
  authority: PublicKey,
  subAccountId = 0
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('user')),
      authority.toBuffer(),
      new anchor.BN(subAccountId).toArrayLike(Buffer, 'le', 2),
    ],
    DRIFT_PROGRAM_ID
  );
}

export function getUserAccountPublicKey(
  authority: PublicKey,
  subAccountId = 0
): PublicKey {
  return getUserAccountPublicKeyAndNonce(authority, subAccountId)[0];
}

export function getUserStatsAccountPublicKey(
  authority: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('user_stats')),
      authority.toBuffer(),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getPerpMarketPublicKey(
  marketIndex: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('perp_market')),
      new anchor.BN(marketIndex).toArrayLike(Buffer, 'le', 2),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getSpotMarketPublicKey(
  marketIndex: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('spot_market')),
      new anchor.BN(marketIndex).toArrayLike(Buffer, 'le', 2),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getSpotMarketVaultPublicKey(
  marketIndex: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('spot_market_vault')),
      new anchor.BN(marketIndex).toArrayLike(Buffer, 'le', 2),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getInsuranceFundVaultPublicKey(
  marketIndex: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('insurance_fund_vault')),
      new anchor.BN(marketIndex).toArrayLike(Buffer, 'le', 2),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getInsuranceFundStakeAccountPublicKey(
  authority: PublicKey,
  marketIndex: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('insurance_fund_stake')),
      authority.toBuffer(),
      new anchor.BN(marketIndex).toArrayLike(Buffer, 'le', 2),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getDriftSignerPublicKey(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(anchor.utils.bytes.utf8.encode('drift_signer'))],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getSerumOpenOrdersPublicKey(
  market: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('serum_open_orders')),
      market.toBuffer(),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getSerumSignerPublicKey(
  market: PublicKey,
  nonce: BN
): PublicKey {
  return anchor.web3.PublicKey.createProgramAddressSync(
    [market.toBuffer(), nonce.toArrayLike(Buffer, 'le', 8)],
    DRIFT_PROGRAM_ID
  );
}

export function getSerumFulfillmentConfigPublicKey(
  market: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('serum_fulfillment_config')),
      market.toBuffer(),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getPhoenixFulfillmentConfigPublicKey(
  market: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('phoenix_fulfillment_config')),
      market.toBuffer(),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getOpenbookV2FulfillmentConfigPublicKey(
  market: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(
        anchor.utils.bytes.utf8.encode('openbook_v2_fulfillment_config')
      ),
      market.toBuffer(),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getReferrerNamePublicKey(
  nameBuffer: number[]
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('referrer_name')),
      Buffer.from(nameBuffer),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getProtocolIfSharesTransferConfigPublicKey(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(anchor.utils.bytes.utf8.encode('if_shares_transfer_config'))],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getPrelaunchOraclePublicKey(
  marketIndex: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('prelaunch_oracle')),
      new anchor.BN(marketIndex).toArrayLike(Buffer, 'le', 2),
    ],
    DRIFT_PROGRAM_ID
  )[0];
}

export function getPythPullOraclePublicKey(
  feedId: Uint8Array
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('pyth_pull')),
      Buffer.from(feedId),
    ],
    DRIFT_PROGRAM_ID,
  )[0];
}
