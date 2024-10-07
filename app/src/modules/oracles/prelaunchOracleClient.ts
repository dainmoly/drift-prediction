import { Connection, PublicKey } from '@solana/web3.js';
import { OracleClient, OraclePriceData } from './types';
import { Program } from '@coral-xyz/anchor';
import { PrelaunchOracle } from '../types';
import { Drift } from '../idls/drift';

export class PrelaunchOracleClient implements OracleClient {
	private connection: Connection;
	private program: Program<Drift>;

	public constructor(connection: Connection, program: Program<Drift>) {
		this.connection = connection;
		this.program = program;
	}

	public async getOraclePriceData(
		pricePublicKey: PublicKey
	): Promise<OraclePriceData | undefined> {
		const accountInfo = await this.connection.getAccountInfo(pricePublicKey);
		if (accountInfo) {
			return this.getOraclePriceDataFromBuffer(accountInfo.data);
		}
	}

	public getOraclePriceDataFromBuffer(buffer: Buffer): OraclePriceData {
		const prelaunchOracle =
			this.program.account.prelaunchOracle.coder.accounts.decodeUnchecked(
				'prelaunchOracle',
				buffer
			) as PrelaunchOracle;

		return {
			price: prelaunchOracle.price,
			slot: prelaunchOracle.ammLastUpdateSlot,
			confidence: prelaunchOracle.confidence,
			hasSufficientNumberOfDataPoints: true,
			maxPrice: prelaunchOracle.maxPrice,
		};
	}
}
