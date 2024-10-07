import { OracleClient } from './types';
import { OracleSource } from '../types';
import { Connection } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { getOracleClient } from './oracleClient';
import { Drift } from '../idls/drift';

export class OracleClientCache {
	cache = new Map<string, OracleClient>();
	public constructor() { }

	public get(
		oracleSource: OracleSource,
		connection: Connection,
		program: Program<Drift>
	) {
		const key = Object.keys(oracleSource)[0];
		if (this.cache.has(key)) {
			return this.cache.get(key);
		}

		const client = getOracleClient(oracleSource, connection, program);
		this.cache.set(key, client);
		return client;
	}
}
