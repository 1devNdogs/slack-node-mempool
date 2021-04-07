export default [
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
];
