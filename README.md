# Mini Blocknative-Slack Script

Thats it, shitty sintax but i made this in a couple of ours.

As pre requisites:

- Create an slack APP
- Attack it to a workspace
- Create a webhook action
- Check and confgigure you app security, if u want.

U need to check several things.

**1.-Check the package.json file**

```
"scripts": {
    "start": "node ./build/index.js",
    // this is for prod
    "dev": "nodemon --exec babel-node ./src/index.js",
    // this is for dev
    "build": "babel -d ./build ./src -s"
    // this is for prod build
  },
```

**2.- Check the .env.sample file, edit with your keys and create a .env**

```
WHOOK_URL="https://hooks.slack.com/services/AAAAAAAAA/AAAAAAAAA/AAAAAAAAA"
BLOCKNATIVE_DAPP=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
ETHERSCAN_API_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
INFURA_PID=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
ALCHEMY_API_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

**3.- Check the src/bnc-config/bnc-config.js file**

In here you can edit the filters to change your strategy.

This is the original sample, it reads ALL the trades in uniswap that matches the methodname
and the pending status.

```
{
    name: "UNISWAP V2 ROUTER",
    id: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
    filters: [
      {
        "contractCall.methodName": [
          "swapExactETHForTokens",
          "swapETHforExactTokens",

          "swapExactTokensForETH",
          "swapTokensForExactETH",

          "swapExactTokensForTokens",
          "swapTokensForExactTokens",
        ],
      },
      {
        status: "pending",
      },
    ],
  },
```

To limit to a single ethereum address for example, you can add:

```
{
    name: "UNISWAP V2 ROUTER",
    id: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
    filters: [
      from: "address to listen"
      ....
    ],
  },

```

To limit to a several ethereum address for example, you can add:

```
{
    name: "UNISWAP V2 ROUTER",
    id: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
    filters: [
      from: ["address1","address2","address3","address4"]
      ....
    ],
},

```

Check the blocknative configuration limits, this JSON only allow 500 chars max i think, so you can edit to fit your need, and if need a lot of addresses create another instance and open several instances to listen more tokens. Maybe add another mempool provider, any feedback its appreciated.

For now , as sample, it works.

Check the blocknative SDK Docs to learn more.

https://docs.blocknative.com/notify-sdk

Specially this section:

https://docs.blocknative.com/notify-sdk#filtering-and-decoding-ethereum-transactions
