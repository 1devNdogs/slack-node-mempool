import dotenv from "dotenv";
dotenv.config({ silent: true });

import request from "request";
import { get } from "https";
import WebSocket from "ws";
import BlocknativeSdk from "bnc-sdk";
import { sdkSetup } from "./bnc-config/sdk-setup.js";
import sdkConfig from "./bnc-config/bnc-config.js";
import { ChainId, Fetcher, Token } from "@uniswap/sdk";
import { TokenAmount, TradeType, Route, Trade } from "@uniswap/sdk";

import moment from "moment";
import { getDefaultProvider } from "ethers";

const provider = getDefaultProvider("homestead", {
  etherscan: process.env.ETHERSCAN_API_KEY,
  infura: process.env.INFURA_PID,
  alchemy: process.env.ALCHEMY_API_KEY,
});

const WHOOK_URL = process.env.WHOOK_URL;
const BLOCKNATIVE_DAPP = process.env.BLOCKNATIVE_DAPP;
const ETHERSCAN_TX = process.env.ETHERSCAN_TX;
const ETHERCHAIN_TX = process.env.ETHERCHAIN_TX;
const ETHERSCAN_ADDRESS = process.env.ETHERSCAN_ADDRESS;
const COINGECKO_TOKEN_LIST_URL = process.env.COINGECKO_TOKEN_LIST_URL;
const SUSHISWAP_TOKEN_LIST_URL = process.env.SUSHISWAP_TOKEN_LIST_URL;
const ONE_INCH_TOKEN_LIST_URL = process.env.ONE_INCH_TOKEN_LIST_URL;
let allTokens = [];

getTokensFromLists(COINGECKO_TOKEN_LIST_URL);
getTokensFromLists(SUSHISWAP_TOKEN_LIST_URL);
getTokensFromLists(ONE_INCH_TOKEN_LIST_URL);

function getTokensFromLists(URL) {
  get(URL, (res) => {
    let body = "";

    res.on("data", (chunk) => {
      body += chunk;
    });

    res.on("end", () => {
      try {
        console.log("START IMPORTING : " + URL);
        allTokens = allTokens.concat(JSON.parse(body).tokens);
        console.log(allTokens.length);
      } catch (e) {
        console.log(e);
      }
    });
  });
}

console.log("7 Seconds to fill tokens pls ....");
console.log("7 Seconds to fill tokens pls ....");
console.log("7 Seconds to fill tokens pls ....");

setTimeout(function () {
  startListen();
}, 7000);

function startListen() {
  console.log("START LISTENING MEMPOOL ");

  const bnc = new BlocknativeSdk({
    name: "Slack_Test_1",
    dappId: BLOCKNATIVE_DAPP,
    ws: WebSocket,
    system: "ethereum",
    networkId: ChainId.MAINNET,
    transactionHandlers: [
      async ({ transaction }) => {
        const {
          hash,
          status,
          contractCall,
          from,
          value,
          timeStamp,
          gasPriceGwei,
          gas,
        } = transaction;
        const { params } = contractCall;
        const { path, to } = contractCall.params;

        const linkEtherscan = ETHERSCAN_TX + hash;
        const linkEtherchain = ETHERCHAIN_TX + hash;
        const linkEtherscanFrom = ETHERSCAN_ADDRESS + from;
        const linkEtherscanTo = ETHERSCAN_ADDRESS + to;
        const date = new moment.utc(new Date(timeStamp), "M/D/YYYY h:mm:ss");

        let tokens = [];

        for (let address of path) {
          let token;
          let tokenAddress = address.toLowerCase();
          let tokenInfo = allTokens.find(
            (x) => x.address.toLowerCase() === tokenAddress
          );
          if (tokenInfo === undefined)
            // limited token info, no symbol, no name, no decimals from fetcher =(
            token = await Fetcher.fetchTokenData(
              ChainId.MAINNET,
              tokenAddress,
              provider
            );
          else {
            // but if we got in the token list, the full information will be here.
            // u can add more token list URL to avoid get in the Fetcher function
            token = new Token(
              ChainId.MAINNET,
              tokenInfo.address,
              tokenInfo.decimals,
              tokenInfo.symbol,
              tokenInfo.name
            );
          }
          tokens.push(token);
        }

        let computedData = {};
        // for swapExact*For*
        if (contractCall.methodName.includes("swapExact")) {
          // in this case, the swap input is on the transaction value, becouse is in ETH
          // as the method name indicates
          const { amountOutMin } = params;

          let amountIn =
            contractCall.methodName === "swapExactETHForTokens"
              ? value
              : params.amountIn;

          const amountInToken = new TokenAmount(tokens[0], amountIn);
          const amountOutMinToken = new TokenAmount(
            tokens[path.length - 1],
            amountOutMin
          );
          computedData = {
            amountInTokenF: amountInToken.toSignificant(6),
            amountOutTokenF: amountOutMinToken.toSignificant(6),
          };
        } else {
          // in this case, the swap input is on the transaction value, becouse is in ETH
          // as the method name indicates
          const { amountOut } = params;

          let amountInMax =
            contractCall.methodName === "swapETHForExactTokens"
              ? value
              : params.amountInMax;

          const amountInMaxToken = new TokenAmount(tokens[0], amountInMax);
          const amountOutToken = new TokenAmount(
            tokens[path.length - 1],
            amountOut
          );
          computedData = {
            amountInTokenF: amountInMaxToken.toSignificant(6),
            amountOutTokenF: amountOutToken.toSignificant(6),
          };
        }

        const message = `************************** New ${status} TX **************************
  From  : ${linkEtherscanFrom}
  To    : ${linkEtherscanTo}
  Hash  : ${linkEtherscan}
  Hash  : ${linkEtherchain}
  Gas---------: ${gas}
  GasPrice----: ${gasPriceGwei}
  TimeStamp---: ${date}
  Method------: ${contractCall.methodName}
  -From Token-: ${ETHERSCAN_ADDRESS + tokens[0].address}
  --> Symbol---: ${tokens[0].symbol}
  --> Amount---: ${computedData.amountInTokenF}
  -To Token---: ${ETHERSCAN_ADDRESS + tokens[path.length - 1].address}
  --> Symbol---: ${tokens[path.length - 1].symbol}
  --> Amount---: ${computedData.amountOutTokenF}
  `;

        postMe(message);
      },
    ],
  });

  sdkSetup(bnc, sdkConfig);
}

function postMe(message) {
  var body = {
    text: message,
  };

  request.post(
    {
      url: WHOOK_URL,
      body: JSON.stringify(body),
    },
    (err, response, body) => {
      if (err) {
        reject(err);
      }
      // console.log("body: ", body);
    }
  );
}
