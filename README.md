# bifrost-js-sdk

JS SDK for [Bifrost](https://github.com/stellar/go/tree/master/services/bifrost).

## Building

```shell
yarn install

# to build for browser
yarn gulp

# to build for node (umd)
yarn gulp build:node
```

## Usage

browser:
```html
<script src="bifrost.min.js"></script>
```
node:
```javascript
import * as Bifrost from "bifrost.js"
```

## API

### `Bifrost.Session.constructor(params) => Bifrost.Session`

Represents Bifrost session with `params` parameters.

`params` is an object with the following fields:

Name | Possible Values | Description
-|-|-
`network` | `test` or `live` | Stellar network to use
`bifrostURL`  | `string`  | URL of Bifrost server
`horizonURL`  | `string`  | URL of Horizon server (_do not use SDF's servers!_)
`horizonAllowHttp` | `boolean` | (Optional) If set to `true` allows HTTP connections to Horizon server. Useful for testing.
`recoveryPublicKey` | `string` | Public key of Stellar account where lumens will be sent in case of failures. (Optional but recommended.)

Example:
```js
var params = {
  network: 'test',
  horizonURL: 'https://horizon-testnet.stellar.org',
  bifrostURL: 'http://localhost:8000'
};

var session = new Bifrost.Session(params);
```

### `Bifrost.Session.startBitcoin(onEvent) => Promise`

Starts Bitcoin session and returns a promise that resolves with Bitcoin address where to send funds and Stellar keypair. Once the session is started, no other session can be created using the same object. You need to create a new one.

Example:
```js
session.startBitcoin(onEvent).then({address, keypair} => {
  document.getElementById("status").innerText = "Waiting for a transaction...";
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
  document.getElementById("status").innerText = "Waiting for a transaction...";
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
`Bifrost.TransactionReceivedEvent` | _none_ | Sent when BTC/ETH transaction is received
`Bifrost.AccountCreatedEvent` | _none_ | Sent when account is created
`Bifrost.AccountConfiguredEvent` | _none_ | Sent when account has been configured
`Bifrost.ExchangedEvent` | _none_ | Sent when tokens have been exchanged
`Bifrost.ExchangedTimelockedEvent` | `{transaction}` | Sent when tokens have been exchanged but access to account is locked (`lock_unix_timestamp` config config parameter in Bifrost). `data` object contains `transaction` XDR that unlocks account after specified time.
`Bifrost.ErrorEvent` | `Error` object | Sent when asynchronous, non-recoverable error occured

Example:
```js
function onEvent(event, data) {
  if (event == Bifrost.TransactionReceivedEvent) {
    setStatus("Transaction received, creating account...", 20)
  } else if (event == Bifrost.AccountCreatedEvent) {
    setStatus("Account created, configuring account...", 40)
  } else if (event == Bifrost.AccountConfiguredEvent) {
    setStatus("Account configured, waiting for tokens...", 60)
  } else if (event == Bifrost.ExchangedEvent) {
    setStatus("Congrats! TOKE purchased. Your Stellar keys: <pre>Public key: "+keypair.publicKey()+"\nSecret key: "+keypair.secret()+"</pre>", 100);
  } else if (event == Bifrost.ExchangedTimelockedEvent) {
    setStatus("Congrats! TOKE purchased but will be locked. Your Stellar keys: <pre>Public key: "+keypair.publicKey()+"\nSecret key: "+keypair.secret()+"</pre>\nUnlock transaction: <pre>"+data.transaction+"</pre>", 100);
  } else if (event == Bifrost.ErrorEvent) {
    setStatus("Error!", 0);
    // Sent data to the log server.
  }
}
```
