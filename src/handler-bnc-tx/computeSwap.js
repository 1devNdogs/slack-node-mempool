import { error } from "consola";
import { TokenAmount, TradeType, Route, Trade, Fetcher } from "@uniswap/sdk";

import { getExcecutionValues, getPrice, getEnvConfig } from "../utils/utils.js";

const { ETHERSCAN_TX, ETHERCHAIN_TX } = getEnvConfig;

export const computeSwap = async (tx, tokens, provider) => {
  const { hash, contractCall, value } = tx;
  const { params } = contractCall;
  const { amountOutMin } = params;
  const length = tokens.length;

  const linkEtherscan = ETHERSCAN_TX + hash;
  const linkEtherchain = ETHERCHAIN_TX + hash;

  const fromToken = tokens[0];
  const toToken = tokens[length - 1];

  let prediction = { linkEtherscan, linkEtherchain };

  const amountIn =
    contractCall.methodName === "swapExactETHForTokens"
      ? value
      : params.amountIn;

  const amountInToken = new TokenAmount(fromToken, amountIn);
  const amountOutMinToken = new TokenAmount(toToken, amountOutMin);

  prediction.entryValues = {
    amountInToken: amountInToken.toSignificant(18),
    amountOutMinToken: amountOutMinToken.toSignificant(18),

    amountInTokenF: amountInToken.toSignificant(6),
    amountOutMinTokenF: amountOutMinToken.toSignificant(6),
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
    const trade = new Trade(route, amountInToken, TradeType.EXACT_INPUT);

    prediction.executionValues = getExcecutionValues(trade);

    const slippage = trade.outputAmount
      .subtract(amountOutMinToken)
      .divide(trade.outputAmount)
      .multiply("100");

    prediction.slippage = slippage.toSignificant(4);
    prediction.executionPrice = getPrice(trade.executionPrice);
    prediction.nextMidPrice = getPrice(trade.nextMidPrice);

    prediction.outValues = {
      confirmedOut: trade.outputAmount.toSignificant(4),
    };
  } catch (e) {
    error("computeSwap: ", e);
    return null;
  }

  return prediction;
};
