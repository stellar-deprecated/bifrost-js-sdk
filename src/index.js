import axios from 'axios';
import Promise from 'bluebird'; // IE11
import {Account, Asset, Keypair, Network, Operation, Server as HorizonServer, TransactionBuilder, StrKey} from 'stellar-sdk';

export const TransactionReceivedEvent = "transaction_received"
export const AccountCreatedEvent = "account_created"
export const AccountConfiguredEvent = "account_configured"
export const ExchangedEvent = "exchanged"
export const ExchangedTimelockedEvent = "exchanged_timelocked"
export const ErrorEvent = "error"

const ProtocolVersion = 2;

const ChainBitcoin = 'bitcoin';
const ChainEthereum = 'ethereum';

export class Session {
  constructor(params) {
    this._checkParams(params);
    this.params = params;

    let horizonOpts = {};
    if (params.horizonAllowHttp !== undefined) {
      horizonOpts.allowHttp = params.horizonAllowHttp
    }
    this.horizon = new HorizonServer(this.params.horizonURL, horizonOpts);
    
    if (params.network == 'test') {
      Network.useTestNetwork();
    } else {
      Network.usePublicNetwork();
    }
    this.started = false;
  }

  startBitcoin(onEvent) {
    return this._start(ChainBitcoin, onEvent);
  }

  startEthereum(onEvent) {
    return this._start(ChainEthereum, onEvent);
  }

  _start(chain, onEvent) {
    if (this.started) {
      throw new Error("Session already started");
    }
    this.started = true;
    this.keypair = Keypair.random();

    return new Promise((resolve, reject) => {
      axios.post(`${this.params.bifrostURL}/generate-${chain}-address`, `stellar_public_key=${this.keypair.publicKey()}`)
        .then(response => {
          if (response.data.chain != chain) {
            return reject("Invalid chain");
          }

          if (response.data.protocol_version != ProtocolVersion) {
            return reject("Invalid protocol_version. Make sure Bifrost server is using the same protocol version.");
          }

          var address = response.data.address;
          resolve({address: address, keypair: this.keypair});

          this.signer = response.data.signer;

          var source = new EventSource(`${this.params.bifrostURL}/events?stream=${address}`);
          source.addEventListener(TransactionReceivedEvent, e => onEvent(TransactionReceivedEvent), false);
          source.addEventListener(AccountCreatedEvent, e => this._onAccountCreated(onEvent), false);
          source.addEventListener(ExchangedEvent, e => {
            onEvent(ExchangedEvent);
            source.close();
          }, false);
          source.addEventListener(ExchangedTimelockedEvent, e => {
            onEvent(ExchangedTimelockedEvent, JSON.parse(e.data));
            source.close();
          }, false);
          source.addEventListener('error', e => console.error(e), false);
        })
        .catch(reject);
    });
  }

  _onAccountCreated(onEvent) {
    onEvent(AccountCreatedEvent);

    // Add Bifrost signer and remove master key
    this.horizon.loadAccount(this.keypair.publicKey())
      .then(sourceAccount => {
        this._onAccountCreatedRecoveryTransactions(sourceAccount.sequenceNumber());

        var transaction = new TransactionBuilder(sourceAccount)
          .addOperation(Operation.setOptions({
            masterWeight: 0,
            signer: {
              ed25519PublicKey: this.signer,
              weight: 1
            }
          }))
          .build();
        transaction.sign(this.keypair);
        return this.horizon.submitTransaction(transaction);
      })
      .then(() => onEvent(AccountConfiguredEvent))
      .catch(e => onEvent(ErrorEvent, e));
  }

  _checkParams(params) {
    if (params === undefined) {
      throw new Error("params not provided");
    }

    if (['live', 'test'].indexOf(params.network) == -1) {
      throw new Error("Invalid params.network");
    }

    let requiredParams = ['bifrostURL', 'horizonURL'];
    for (let param of requiredParams) {
      if (typeof params[param] != 'string') {
        throw new Error(`params.${param} required and must be of type 'string'`);
      }
    }

    if (params.recoveryPublicKey !== undefined) {
      if (!StrKey.isValidEd25519PublicKey(params.recoveryPublicKey)) {
        throw new Error(`params.recoveryPublicKey is invalid`);
      }
    }
  }

  _onAccountCreatedRecoveryTransactions(currentSequenceNumber) {
    if (this.params.recoveryPublicKey === undefined) {
      return;
    }

    var account = new Account(this.keypair.publicKey(), currentSequenceNumber);
    var transaction = new TransactionBuilder(account)
      .addOperation(Operation.accountMerge({
        destination: this.params.recoveryPublicKey
      }))
      .build();
    transaction.sign(this.keypair);
    this._submitRecovery(transaction);
  }


  _submitRecovery(transaction) {
    var envelope = transaction.toEnvelope().toXDR().toString("base64");
    var envelopeEncoded = encodeURIComponent(envelope);
    return axios.post(`${this.params.bifrostURL}/recovery-transaction`, `transaction_xdr=${envelopeEncoded}`);
  }
}
