#[derive(Clone, Copy, PartialEq, Debug, Eq)]
pub enum PausedOperations {
    /// funding rate updates are paused
    Funding = 0b00000001,
    /// amm fills are prevented/blocked
    AmmFills = 0b00000010,
    /// fills are blocked
    Fill = 0b00000100,
    /// perp: pause settling negative pnl | spot: pause depositing asset
    Withdraw = 0b00001000,
}

impl PausedOperations {
    pub fn is_operation_paused(current: u8, operation: PausedOperations) -> bool {
        current & operation as u8 != 0
    }
}