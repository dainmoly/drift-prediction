import { decodeStateData, StateAccount } from '@/modules';
import { RPC_URL, DRIFT_PROGRAM_ID } from '@/constants';
import { Connection, PublicKey } from '@solana/web3.js';
import { create } from 'zustand'

interface GlobalState {

    state: StateAccount | null,
    setState: (state: StateAccount) => void,

    fetchState: () => void,
}

export const useGlobalStore = create<GlobalState>()(
    (set) => ({

        state: null,
        setState: (state: StateAccount) => {
            set({
                state
            });
        },

        fetchState: async () => {

            const connection = new Connection(RPC_URL);

            const stateData = await connection.getProgramAccounts(DRIFT_PROGRAM_ID, {
                commitment: 'confirmed',
                filters: [
                    {
                        memcmp: {
                            offset: 0,
                            bytes: "dE27dVH2wR2",
                        }
                    }
                ]
            });

            if (stateData.length > 0) {
                const state = decodeStateData(stateData[0].account.data);
                set({
                    state: state
                })
            }
        },

    }),
)