import { error } from "consola";
import { TokenAmount, TradeType, Route, Trade, Fetcher } from "@uniswap/sdk";

import { getExcecutionValues, getPrice, getEnvConfig } from "../utils/utils.js";

const { ETHERSCAN_TX, ETHERCHAIN_TX } = getEnvConfig;

export const computeSwapInverted = async (tx, tokens, provider) => {
  const { hash, contractCall, value } = tx;
  const { params } = contractCall;
  const { amountOut } = params;
  const length = tokens.length;

  const linkEtherscan = ETHERSCAN_TX + hash;
  const linkEtherchain = ETHERCHAIN_TX + hash;

  const fromToken = tokens[0];
  const toToken = tokens[length - 1];

  let prediction = { linkEtherscan, linkEtherchain };

  const amountInMax =
    contractCall.methodName === "swapETHForExactTokens"
      ? value
      : params.amountInMax;

  const amountInMaxToken = new TokenAmount(fromToken, amountInMax);
  const amountOutToken = new TokenAmount(toToken, amountOut);

  prediction.entryValues = {
    amountInMaxToken: amountInMaxToken.toSignificant(18),
    amountOutToken: amountOutToken.toSignificant(18),

    amountInTokenF: amountInMaxToken.toSignificant(6),
    amountOutTokenF: amountOutToken.toSignificant(6),
  };

  prediction.fromToken = fromToken;
  prediction.toToken = toToken;

  try {
    let pairs = [];
    let idx = 0;

    for (let token of tokens) {
      if (idx < length - 1) {
        const tf = token;
        const tt = tokens[idx + 1];

        const pair = await Fetcher.fetchPairData(tf, tt, provider);
        pairs.push(pair);
      }
      idx++;
    }

    const route = new Route(pairs, fromToken);
    const trade = new Trade(route, amountOutToken, TradeType.EXACT_OUTPUT);

    prediction.executionValues = getExcecutionValues(trade);

    const nowPrice = route.midPrice.toSignificant(6);
    const executionPrice = trade.executionPrice.toSignificant(6);

    const slippage =
      ((parseFloat(nowPrice) - parseFloat(executionPrice)) /
        parseFloat(nowPrice)) *
      parseFloat(100);

    prediction.slippage = slippage.toFixed(4);
    prediction.executionPrice = getPrice(trade.executionPrice);
    prediction.nextMidPrice = getPrice(trade.nextMidPrice);

    prediction.outValues = {
      confirmedIn: trade.inputAmount.toSignificant(4),
    };
  } catch (e) {
    error("computeSwapInverted: ", e);
    return null;
  }

  return prediction;
};
