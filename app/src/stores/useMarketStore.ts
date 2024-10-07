import { decodePerpMarketData, decodeSpotMarketData, PerpMarketAccount, SpotMarketAccount } from '@/modules';
import { DRIFT_PROGRAM_ID, RPC_URL } from '@/constants';
import { Connection } from '@solana/web3.js';
import { create } from 'zustand'

interface MarketState {

    perpMarkets: PerpMarketAccount[],
    setPerpMarkets: (markets: PerpMarketAccount[]) => void,

    spotMarkets: SpotMarketAccount[],
    setSpotMarkets: (markets: SpotMarketAccount[]) => void,

    fetchPerpMarkets: () => void,
    fetchSpotMarkets: () => void,
}

export const useMarketStore = create<MarketState>()(
    (set) => ({

        perpMarkets: [],
        setPerpMarkets: (markets: PerpMarketAccount[]) => {
            set({
                perpMarkets: markets
            });
        },

        spotMarkets: [],
        setSpotMarkets: (markets: SpotMarketAccount[]) => {
            set({
                spotMarkets: markets
            });
        },


        fetchPerpMarkets: async () => {

            const connection = new Connection(RPC_URL);

            const marketsData = await connection.getProgramAccounts(DRIFT_PROGRAM_ID, {
                commitment: 'confirmed',
                filters: [
                    {
                        memcmp: {
                            offset: 0,
                            bytes: "2pTyMkwXuti",
                        }
                    }
                ]
            });

            let markets = marketsData.map(({ pubkey, account }) => {
                return decodePerpMarketData(account.data)
            }).sort((a, b) => a.marketIndex - b.marketIndex);

            set({ perpMarkets: markets })
        },

        fetchSpotMarkets: async () => {

            const connection = new Connection(RPC_URL);

            const marketsData = await connection.getProgramAccounts(DRIFT_PROGRAM_ID, {
                commitment: 'confirmed',
                filters: [
                    {
                        memcmp: {
                            offset: 0,
                            bytes: "HqqNdyfVbzv",
                        }
                    }
                ]
            });

            let markets = marketsData.map(({ pubkey, account }) => {
                return decodeSpotMarketData(account.data)
            }).sort((a, b) => a.marketIndex - b.marketIndex);

            set({ spotMarkets: markets })
        }

    }),
)