import {
	ClientSubscriptionId,
	Connection,
	Context,
	RpcResponseAndContext,
	SignatureResult,
	SignatureStatus,
	TransactionConfirmationStatus,
} from '@solana/web3.js';
import { DEFAULT_CONFIRMATION_OPTS } from '../config';
import { TxSendError } from '@drift-labs/sdk';
import { NOT_CONFIRMED_ERROR_CODE } from '../constants/txConstants';
import { getTransactionErrorFromTxSig, reportTransactionError } from '../tx/reportTransactionError';

type ResolveReference = {
	resolve?: () => void;
};

const confirmationStatusValues: Record<TransactionConfirmationStatus, number> =
	{
		processed: 0,
		confirmed: 1,
		finalized: 2,
	};

interface TransactionConfirmationRequest {
	txSig: string;
	desiredConfirmationStatus: TransactionConfirmationStatus;
	timeout: number;
	pollInterval: number;
	searchTransactionHistory: boolean;
	startTime: number;
	resolve: (status: SignatureStatus) => void;
	reject: (error: Error) => void;
}

/**
 * Class to await for transaction confirmations in an optimised manner. It tracks a shared list of all pending transactions and fetches them in bulk in a shared RPC request whenever they have an "overlapping" polling interval. E.g. tx1 with an interval of 200ms and tx2 with an interval of 300ms (if sent at the same time) will be fetched together at at 600ms, 1200ms, 1800ms, etc.
 */
export class TransactionConfirmationManager {
	private connection: Connection;
	private pendingConfirmations: Map<string, TransactionConfirmationRequest> =
		new Map();
	private intervalId: NodeJS.Timeout | null = null;

	constructor(connection: Connection) {
		this.connection = connection;
	}

	private promiseTimeout<T>(
		promise: Promise<T>,
		timeoutMs: number
	): Promise<T | null> {
		let timeoutId: ReturnType<typeof setTimeout>;
		const timeoutPromise: Promise<null> = new Promise((resolve) => {
			timeoutId = setTimeout(() => resolve(null), timeoutMs);
		});

		return Promise.race([promise, timeoutPromise]).then((result: T | null) => {
			clearTimeout(timeoutId);
			return result;
		});
	}

	private async checkConfirmationResultForError(
		txSig: string,
		result: SignatureResult
	) {
		if (result.err) {
			await reportTransactionError(txSig, this.connection);
		}

		return;
	}

	async confirmTransactionWebSocket(
		txSig: string,
		timeout = 30000,
		desiredConfirmationStatus = DEFAULT_CONFIRMATION_OPTS.commitment as TransactionConfirmationStatus
	): Promise<RpcResponseAndContext<SignatureResult>> {
		const start = Date.now();
		const subscriptionCommitment =
			desiredConfirmationStatus || DEFAULT_CONFIRMATION_OPTS.commitment;

		let response: RpcResponseAndContext<SignatureResult> | null = null;

		let subscriptionId: ClientSubscriptionId;

		const confirmationPromise = new Promise((resolve, reject) => {
			try {
				subscriptionId = this.connection.onSignature(
					txSig,
					(result: SignatureResult, context: Context) => {
						console.debug(`transaction_confirmation_manager`, `got_confirmation_via_websocket`);
						response = {
							context,
							value: result,
						};
						resolve(null);
					},
					subscriptionCommitment
				);
			} catch (err) {
				reject(err);
			}
		});

		// We do a one-shot confirmation check just in case the transaction is ALREADY confirmed when we create the websocket confirmation .. We want to run this concurrently with the onSignature subscription. If this returns true then we can return early as the transaction has already been confirmed.
		const oneShotConfirmationPromise = this.oneShotCheckTxConfirmation(
			txSig,
		);

		const resolveReference: ResolveReference = {};

		// This is the promise we are waiting on to resolve the overall confirmation. It will resolve the faster of a positive oneShot confirmation, or the websocket confirmation, or the timeout.
		const overallWaitingForConfirmationPromise = new Promise<void>((resolve) => {
			resolveReference.resolve = resolve;
		});

		// Await for the one shot confirmation and resolve the waiting promise if we get a positive confirmation result
		oneShotConfirmationPromise.then(
			async (oneShotResponse) => {
				if (!oneShotResponse || !oneShotResponse?.value?.[0]) return;

				const resultValue = oneShotResponse.value[0];


				await this.checkConfirmationResultForError(txSig, resultValue);

				if (
					this.checkStatusMatchesDesiredConfirmationStatus(
						resultValue,
						desiredConfirmationStatus
					)
				) {
					console.debug(`transaction_confirmation_manager`, `got_confirmation_via_oneshot_in_websocket`);
					response = {
						context: oneShotResponse.context,
						value: oneShotResponse.value[0],
					};
					resolveReference.resolve?.();
				}
			},
			(onRejected) => {
				throw onRejected;
			}
		);

		// Await for the websocket confirmation with the configured timeout
		this.promiseTimeout(confirmationPromise, timeout).then(
			() => {
				resolveReference.resolve?.();
			},
			(onRejected) => {
				throw onRejected;
			}
		);

		try {
			await overallWaitingForConfirmationPromise;
		} finally {
			if (subscriptionId !== undefined) {
				this.connection.removeSignatureListener(subscriptionId);
			}
		}

		const duration = (Date.now() - start) / 1000;

		if (response === null) {
			throw new TxSendError(
				`Transaction was not confirmed in ${duration.toFixed(
					2
				)} seconds. It is unknown if it succeeded or failed. Check signature ${txSig} using the Solana Explorer or CLI tools.`,
				NOT_CONFIRMED_ERROR_CODE
			);
		}

		return response;
	}

	async confirmTransactionPolling(
		txSig: string,
		desiredConfirmationStatus = DEFAULT_CONFIRMATION_OPTS.commitment as TransactionConfirmationStatus,
		timeout = 30000,
		pollInterval = 1000,
		searchTransactionHistory = false
	): Promise<SignatureStatus> {
		// Interval must be > 400ms and a multiple of 100ms
		if (pollInterval < 400 || pollInterval % 100 !== 0) {
			throw new Error(
				'Transaction confirmation polling interval must be at least 400ms and a multiple of 100ms'
			);
		}

		return new Promise((resolve, reject) => {
			this.pendingConfirmations.set(txSig, {
				txSig,
				desiredConfirmationStatus,
				timeout,
				pollInterval,
				searchTransactionHistory,
				startTime: Date.now(),
				resolve,
				reject,
			});

			if (!this.intervalId) {
				this.startConfirmationLoop();
			}
		});
	}

	private startConfirmationLoop() {
		this.intervalId = setInterval(() => this.checkPendingConfirmations(), 100);
	}

	private async checkPendingConfirmations() {
		const now = Date.now();
		const transactionsToCheck: TransactionConfirmationRequest[] = [];

		for (const [txSig, request] of this.pendingConfirmations.entries()) {
			if (now - request.startTime >= request.timeout) {
				request.reject(
					new Error(
						`Transaction confirmation timeout after ${request.timeout}ms`
					)
				);
				this.pendingConfirmations.delete(txSig);
			} else if ((now - request.startTime) % request.pollInterval < 100) {
				transactionsToCheck.push(request);
			}
		}

		if (transactionsToCheck.length > 0) {
			await this.checkTransactionStatuses(transactionsToCheck);
		}

		if (this.pendingConfirmations.size === 0 && this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	private checkStatusMatchesDesiredConfirmationStatus(
		status: SignatureStatus,
		desiredConfirmationStatus: TransactionConfirmationStatus
	): boolean {
		if (
			status.confirmationStatus &&
			confirmationStatusValues[status.confirmationStatus] >=
				confirmationStatusValues[desiredConfirmationStatus]
		) {
			return true;
		}

		return false;
	}

	private async oneShotCheckTxConfirmation(
		txSig: string,
	) {
		const result = await this.connection.getSignatureStatuses([txSig]);

		return result;
	}

	private async checkTransactionStatuses(
		requests: TransactionConfirmationRequest[]
	) {
		const txSigs = requests.map((request) => request.txSig);
		const { value: statuses } = await this.connection.getSignatureStatuses(
			txSigs,
			{
				searchTransactionHistory: requests.some(
					(req) => req.searchTransactionHistory
				),
			}
		);

		if (!statuses || statuses.length !== txSigs.length) {
			throw new Error('Failed to get signature statuses');
		}

		for (let i = 0; i < statuses.length; i++) {
			const status = statuses[i];
			const request = requests[i];

			if (status === null) {
				continue;
			}


			if (status.err) {
				this.pendingConfirmations.delete(request.txSig);
				request.reject(
					await getTransactionErrorFromTxSig(request.txSig, this.connection)
				);
				continue;
			}

			if (
				confirmationStatusValues[status.confirmationStatus] === undefined ||
				confirmationStatusValues[request.desiredConfirmationStatus] ===
					undefined
			) {
				throw new Error(
					`Invalid confirmation status when awaiting confirmation: ${status.confirmationStatus}`
				);
			}

			if (
				this.checkStatusMatchesDesiredConfirmationStatus(
					status,
					request.desiredConfirmationStatus
				)
			) {
				console.debug(`transaction_confirmation_manager`, `got_confirmation_via_polling`);
				request.resolve(status);
				this.pendingConfirmations.delete(request.txSig);
			}
		}
	}
}
