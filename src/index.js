import axios from 'axios';
import Promise from 'bluebird'; // IE11
import {Asset, Keypair, Network, Operation, Server as HorizonServer, TransactionBuilder, StrKey} from 'stellar-sdk';

export const TransactionReceivedEvent = "transaction_received"
export const AccountCreatedEvent = "account_created"
export const TrustLinesCreatedEvent = "trust_lines_created"
export const AccountCreditedEvent = "account_credited"
export const PurchasedEvent = "purchased"

const ChainBitcoin = 'bitcoin';
const ChainEthereum = 'ethereum';

export class Session {
  constructor(params) {
    this._checkParams(params);
    this.params = params;
    this.horizon = new HorizonServer(this.params.horizonURL);
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

    var keypair = Keypair.random();
    return new Promise((resolve, reject) => {
      axios.post(`${this.params.bifrostURL}/generate-${chain}-address`, `stellar_public_key=${keypair.publicKey()}`)
        .then(response => {
          if (response.data.chain != chain) {
            return reject("Invalid chain");
          }

          var address = response.data.address;
          resolve(address);

          var source = new EventSource(`${this.params.bifrostURL}/events?stream=${address}`);
          source.addEventListener('transaction_received', e => onEvent(TransactionReceivedEvent), false);
          source.addEventListener('account_created', e => this._onAccountCreated(onEvent, keypair, chain), false);
          source.addEventListener('account_credited', e => {
            this._onAccountCredited(onEvent, keypair, JSON.parse(e.data));
            source.close();
          }, false);
          source.addEventListener('error', e => console.error(e), false);
        })
        .catch(reject);
    });
  }

  _onAccountCreated(onEvent, keypair, chain) {
    onEvent(AccountCreatedEvent);

    let chainAssetCode;
    if (chain == ChainBitcoin) {
      chainAssetCode = 'BTC';
    } else if (chain == ChainEthereum) {
      chainAssetCode = 'ETH';
    }

    // Create trust lines
    this.horizon.loadAccount(keypair.publicKey())
      .then(sourceAccount => {
        var transaction = new TransactionBuilder(sourceAccount)
          .addOperation(Operation.changeTrust({
            asset: new Asset(chainAssetCode, this.params.issuingPublicKey)
          }))
          .addOperation(Operation.changeTrust({
            asset: new Asset(this.params.assetCode, this.params.issuingPublicKey)
          }))
          .build();
        transaction.sign(keypair);
        return this.horizon.submitTransaction(transaction);
      }).then(function() {
        onEvent(TrustLinesCreatedEvent);
      })
  }

  _onAccountCredited(onEvent, keypair, {assetCode, amount}) {
    onEvent(AccountCreditedEvent);
    // Buy asset
    this.horizon.loadAccount(keypair.publicKey())
      .then(sourceAccount => {
        var transaction = new TransactionBuilder(sourceAccount)
          .addOperation(Operation.manageOffer({
            selling: new Asset(assetCode, this.params.issuingPublicKey),
            buying: new Asset(this.params.assetCode, this.params.issuingPublicKey),
            amount: amount,
            price: this.params.price
          }))
          .build();
        transaction.sign(keypair);
        return this.horizon.submitTransaction(transaction);
      }).then(() => onEvent(PurchasedEvent, {publicKey: keypair.publicKey(), secret: keypair.secret()}));
  }

  _checkParams(params) {
    if (params === undefined) {
      throw new Error("params not provided");
    }

    if (['live', 'test'].indexOf(params.network) == -1) {
      throw new Error("Invalid params.network");
    }

    if (!StrKey.isValidEd25519PublicKey(params.issuingPublicKey)) {
      throw new Error("Invalid params.issuingPublicKey");
    }

    let requiredParams = ['bifrostURL', 'horizonURL', 'assetCode', 'price'];
    for (let param of requiredParams) {
      if (params[param] == undefined) {
        throw new Error(`params.${param} required`);
      }
    }
  }
}
