# Modify keeper role as 0 staked for test
/programs/drift/src/instructions/keeper.rs:handle_update_perp_bid_ask_twap
Update min_if_stake variable as 0

# Contract modifications
 - Add resolve_ts and resolve_oracle to PerpMarket
    resolve_oracle: SwitchboardOnDemand address
    resolve_ts: u64
    modify PerpMarket size from 1216 to 1232
 - Add resolve_ts param to initialize_prediction_market ix
 - Add oracle account to initialize_prediction_market ix
 - Add resolve_prediction_market ix
    Mainly used update_expiry_ts ix logic

# Potential bugs
 - Delete initialized prediction market works, but after that, create market not worked because number_of_markets reduced.

# Deploy program

 - We need to keep existing programIds like pyth, switchboard etc.
 - To generate new programId for drift devnet only, run `anchor build`
 - Get pk from target/deploy/drift-keypair.json
 - Replace programId in anchor.toml and lib.rs
 - Run `anchor build -- --no-default-features` again and deploy to devnet with this.
 `solana program deploy target/deploy/drift.so -u d`
 - If deploy to mainnet, then build without feature flag, and -u as m.
 - Upload IDL to verify
 `anchor idl init -f target/idl/drift.json 9u2HBKPQtouLjmepiaema1LF99Ah7YyViJ8kLe8D236w --provider.cluster devnet`


# Initialize state account

# Initialize user account

# Create quote market as marketIndex 0 and oracleProvider as QUOTE_ASSET

# Create other quote markets with pyth or switchboard whatever.

# Create prediction market after spot market creation.