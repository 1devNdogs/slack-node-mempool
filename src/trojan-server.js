import { success, fatal, info } from "consola";
import WebSocket from "ws";
import mongoose from "mongoose";
import { getDefaultProvider } from "ethers";
import { Telegraf } from "telegraf";

import { newToken, getEnvConfig, getCollectionNames } from "./utils/utils.js";
import { savePending } from "./utils/mongo/savePending.js";
import { mongoUrl, mongoParams } from "./utils/mongo/config.js";
import { TokenSchema } from "./models/TokenTrojan.js";
import { TransactionSchema } from "./models/Transaction.js";
import { allowedTokensData } from "./data/allowedTokens.js";

import { ChainId, Fetcher } from "@uniswap/sdk";

import BlocknativeSdk from "bnc-sdk";
import { sdkSetup } from "./bnc-config/sdk-setup.js";
import { computeSwap } from "./handler-bnc-tx/computeSwap.js";

const ALLOWED_TOKENS_ARRAY = allowedTokensData();

const {
  BLOCKNATIVE_DAPP,
  BLOCKNATIVE_DAPP_EMMITER,
  METHOD,
  ETHERSCAN_API_KEY,
  INFURA_PID,
  ALCHEMY_API_KEY,
  ETHERSCAN_TX,
  ETHERCHAIN_TX,
  BOT_TOKEN,
  BOT_CHAT_ID,
  STAGE,
} = getEnvConfig;

const { PENDING, TRASH, TOKENS_ALL } = getCollectionNames;

const bot = new Telegraf(BOT_TOKEN);

const provider = getDefaultProvider("homestead", {
  etherscan: ETHERSCAN_API_KEY,
  infura: INFURA_PID,
  alchemy: ALCHEMY_API_KEY,
});

const allTokensModel = mongoose.model(TOKENS_ALL, TokenSchema);
const pendingsModel = mongoose.model(PENDING, TransactionSchema);
const trashModel = mongoose.model(TRASH, TransactionSchema);

let isConnectedBefore = false;

const connect = () => {
  mongoose.connect(mongoUrl, mongoParams);
};

connect();

mongoose.connection.on("error", () => {
  fatal("Could not connect to MongoDB");
  try {
    if (STAGE === "PRODUCTION")
      bot.telegram.sendMessage(
        BOT_CHAT_ID,
        "Could not connect to MongoDB - Server Normal"
      );
  } catch (e) {}
});

mongoose.connection.on("disconnected", () => {
  fatal("Lost MongoDB connection...");
  try {
    if (STAGE === "PRODUCTION")
      bot.telegram.sendMessage(
        BOT_CHAT_ID,
        "Lost MongoDB connection... - Server Normal"
      );
  } catch (e) {}

  if (!isConnectedBefore) connect();
});

mongoose.connection.on("connected", () => {
  isConnectedBefore = true;
  info("Connection established to MongoDB");
  success(`Runing ${METHOD[0].filters[0]["contractCall.methodName"]}`);
  startServer(METHOD[0].filters[0]["contractCall.methodName"]);
});

// Close the Mongoose connection, when receiving SIGINT
process.on("SIGINT", () => {
  mongoose.connection.close(() => {
    fatal("Force to close the MongoDB conection");
    process.exit(0);
  });
});

const startServer = (appName) => {
  const bncEmitter = new BlocknativeSdk({
    name: "UniswapTrades_EMMITER_" + appName,
    dappId: BLOCKNATIVE_DAPP_EMMITER,
    ws: WebSocket,
    system: "ethereum",
    networkId: ChainId.MAINNET,
  });

  const bnc = new BlocknativeSdk({
    name: "UniswapTrades_" + appName,
    dappId: BLOCKNATIVE_DAPP,
    ws: WebSocket,
    system: "ethereum",
    networkId: ChainId.MAINNET,
    transactionHandlers: [
      async ({ transaction }) => {
        const { hash, status, contractCall } = transaction;
        const { path } = contractCall.params;

        const linkEtherscan = ETHERSCAN_TX + hash;
        const linkEtherchain = ETHERCHAIN_TX + hash;

        const message = `|${status}| \n     ${linkEtherscan}\n     ${linkEtherchain}`;
        success(`1) INCOMING ${message}`);

        const badTx = await trashModel.findOne({
          hash,
        });
        const existTx = await pendingsModel.findOne({
          hash,
        });

        if (!badTx && !existTx) {
          const tokenStart = path[0].toLowerCase();
          const tokenEnd = path[path.length - 1].toLowerCase();

          const isAllowed =
            ALLOWED_TOKENS_ARRAY.includes(tokenStart) ||
            ALLOWED_TOKENS_ARRAY.includes(tokenEnd);

          if (isAllowed) {
            success(`2) ALLOWED ${message}`);
            let prediction = null;
            let tokens = [];

            for (let address of path) {
              let token;
              let tokenAddress = address.toLowerCase();

              const tokenData = await allTokensModel.findOne({
                address: tokenAddress,
              });

              if (tokenData === null) {
                token = await Fetcher.fetchTokenData(
                  ChainId.MAINNET,
                  tokenAddress,
                  provider
                );
              } else {
                token = newToken(tokenData);
              }
              tokens.push(token);
            }

            prediction = await computeSwap(transaction, tokens, provider);

            if (prediction) savePending(transaction, prediction, bncEmitter);
            else info(`3) Prediction has failed: ${linkEtherscan}`);
          } else {
            info(`3) NOT Allowed: ${linkEtherscan}`);
          }
        } else {
          info(`2) TX Exist as Bad or Pending : ${linkEtherscan}`);
        }
      },
    ],
  });

  info("Allowed Tokens", METHOD[0].filters[1]);
  info("Allowed Tokens", ALLOWED_TOKENS_ARRAY);

  sdkSetup(bnc, METHOD);
  sdkSetup(bncEmitter, METHOD);
};
