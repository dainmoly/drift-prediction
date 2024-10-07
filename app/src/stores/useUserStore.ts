import { decodeUserData, decodeUserStatsData, getUserAccountPublicKey, getUserStatsAccountPublicKey } from '@/modules';
import { DRIFT_PROGRAM_ID, RPC_URL } from '@/constants';
import { UserAccount, UserStatsAccount } from '@/modules/types';
import { Connection, PublicKey } from '@solana/web3.js';
import { create } from 'zustand'

interface UserState {

    users: UserAccount[],
    setUsers: (users: UserAccount[]) => void,

    userStats: UserStatsAccount[],
    setUserStats: (stats: UserStatsAccount[]) => void,

    fetchUser: (pubkey: PublicKey) => void,
    fetchAllUsers: () => void,

    fetchUserStats: (pubkey: PublicKey) => void,
}

export const useUserStore = create<UserState>()(
    (set, get) => ({

        users: [],
        setUsers: (users: UserAccount[]) => {
            set({
                users
            });
        },

        userStats: [],
        setUserStats: (statsArr: UserStatsAccount[]) => {
            set({
                userStats: statsArr
            });
        },

        fetchAllUsers: async () => {

            const connection = new Connection(RPC_URL);

            const usersData = await connection.getProgramAccounts(DRIFT_PROGRAM_ID, {
                commitment: 'confirmed',
                filters: [
                    {
                        memcmp: {
                            offset: 0,
                            bytes: "TfwwBiNJtao",
                        }
                    }
                ]
            });

            let users = usersData.map(({ pubkey, account }) => {
                return decodeUserData(account.data)
            });
            set({ users })
        },

        fetchUser: async (pubkey: PublicKey) => {

            const connection = new Connection(RPC_URL);

            const userPubkey = getUserAccountPublicKey(pubkey);
            const userData = await connection.getAccountInfo(userPubkey, 'confirmed');

            const userArr = get().users;
            if (userData) {
                const user = decodeUserData(userData.data);
                const idx = userArr.findIndex(t => t.authority.equals(pubkey));
                if (idx == -1) {
                    userArr.push(user);
                }
                else {
                    userArr[idx] = user;
                }

                set({
                    users: userArr
                });
            }
        },


        fetchUserStats: async (pubkey: PublicKey) => {
            const statsArr = get().userStats;

            const connection = new Connection(RPC_URL);

            const statsPubkey = getUserStatsAccountPublicKey(pubkey);
            const statsData = await connection.getAccountInfo(statsPubkey, 'confirmed');
            if (statsData) {
                const stats = decodeUserStatsData(statsData.data);
                const idx = statsArr.findIndex(t => t.authority.equals(pubkey));
                if (idx == -1) {
                    statsArr.push(stats);
                }
                else {
                    statsArr[idx] = stats;
                }

                set({
                    userStats: statsArr
                });
            }
        }

    })
)