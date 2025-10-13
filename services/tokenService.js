const axios = require("axios");
const { ethers } = require("ethers");

const getTokenBalance = async (contractAddress, walletAddress) => {
  try {
    const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");

    const erc20ABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ];

    const contract = new ethers.Contract(contractAddress, erc20ABI, provider);

    const [balanceWei, decimals, symbol] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
      contract.symbol()
    ]);

    const balance = ethers.formatUnits(balanceWei, decimals);

    return { balance, decimals, symbol };
  } catch (error) {
    console.error(`Error fetching balance for ${contractAddress}:`, error.message);
    return { balance: "0", decimals: 18, symbol: "UNKNOWN" };
  }
};

const getTokenUsdPrice = async (contractAddress) => {
  try {
    const url = `https://api.dexscreener.com/tokens/v1/avalanche/${contractAddress}`;
    const { data } = await axios.get(url, { timeout: 10000 });

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn(`⚠️ No price data found for contract: ${contractAddress}`);
      return 0;
    }

    const price = parseFloat(data[0].priceUsd);
    return Number.isFinite(price) ? price : 0;
  } catch (err) {
    console.error(`Error fetching price from Dexscreener for ${contractAddress}:`, err.message);
    return 0;
  }
};

// 👇 export using CommonJS
module.exports = {
  getTokenBalance,
  getTokenUsdPrice,
};
