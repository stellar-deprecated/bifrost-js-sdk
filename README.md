# bifrost-js-sdk

JS SDK for [Bifrost](https://github.com/stellar/go/tree/master/services/bifrost).

## Usage

```html
<script src="bifrost.min.js"></script>
```

## API

### `Bifrost.Session.constructor(params) => Bifrost.Session`

Represents Bifrost session with `params` parameters.

`params` is an object with the following fields:

Name | Possible Values | Description
-|-|-
`network` | `test` or `live` | Stellar network to use
`issuingPublicKey` | Stellar public key | Public key of issuing account
`assetCode` | `string` | Asset code of token to sell, ex. `TOKE`
`price` | `string` | Maximum price of 1 `assetCode` token (in `BTC` or `ETH` depending which `start*` method is used)
`bifrostURL` | `string` | URL of Bifrost server
`horizonURL` | `string` | URL of Horizon server (_do not use SDF's servers!_)

Example: 
```js
var params = {
  network: 'test',
  horizonURL: 'https://horizon-testnet.stellar.org',
  bifrostURL: 'http://localhost:8000',
  assetCode: 'TOKE',
  price: '1',
  issuingPublicKey: 'GDGVTKSEXWB4VFTBDWCBJVJZLIY6R3766EHBZFIGK2N7EQHVV5UTA63C',
};

var session = new Bifrost.Session(params);
```

### `Bifrost.Session.startBitcoin(onEvent) => Promise`

Starts Bitcoin session and returns a promise that resolves with Bitcoin address where to send funds and Stellar keypair. Once the session is started, no other session can be created using the same object. You need to create a new one.

Example:
```js
session.startBitcoin(onEvent).then({address, keypair} => {
  document.getElementById("address").innerText = "Waiting for a transaction...";
  document.getElementById("address").innerText = address;
  document.getElementById("public-key").innerText = keypair.publicKey();
  document.getElementById("secret").innerText = keypair.secret();
})
```

`onEvent` description can be found in the section below.

### `Bifrost.Session.startEthereum(onEvent) => Promise`

Starts Ethereum session and returns a promise that resolves with Ethereum address where to send funds and Stellar keypair. Once the session is started, no other session can be created using the same object. You need to create a new one.

Example:
```js
session.startEthereum(onEvent).then({address, keypair} => {
  document.getElementById("address").innerText = "Waiting for a transaction...";
  document.getElementById("address").innerText = address;
  document.getElementById("public-key").innerText = keypair.publicKey();
  document.getElementById("secret").innerText = keypair.secret();
})
```

`onEvent` description can be found in the section below.

### `onEvent(event, data)`

`onEvent` function you pass to `startBitcoin` or `startEthereum` function accepts one parameter `event` described below:

`event` | `data` | Description
-|-|-
`Bifrost.AccountCreatedEvent` | _none_ | Sent when account is created
`Bifrost.TrustLinesCreatedEvent` | _none_ | Sent when trust line is created
`Bifrost.AccountCreditedEvent` | _none_ | Sent when account is credited
`Bifrost.PurchasedEvent` | _none_ | Sent when token is purchased
`Bifrost.ErrorEvent` | `Error` object | Sent when asynchronous, nonrecoverable error occured

Example:
```js
function onEvent(event, data) {
  if (event == Bifrost.TransactionReceivedEvent) {
    setStatus("Transaction received, creating account...");
  } else if (event == Bifrost.AccountCreatedEvent) {
    setStatus("Account created, creating trust lines...");
  } else if (event == Bifrost.TrustLinesCreatedEvent) {
    setStatus("Trust lines created, waiting for tokens...");
  } else if (event == Bifrost.AccountCreditedEvent) {
    setStatus("Account credited, exchanging...");
  } else if (event == Bifrost.PurchasedEvent) {
    setStatus("Congrats! TOKE purchased.");
  } else if (event == Bifrost.ErrorEvent) {
    setStatus("Error!");
    // Send `data` to the log server.
  }
}
```
