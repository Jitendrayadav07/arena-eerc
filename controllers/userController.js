const Response = require("../classes/Response");
const db = require("../config/db.config");
const axios = require("axios");

const getUserWallet = async (req, res) => {
  try {
    const wallet = "0x94a27a070ae4ed87e5025049a407F8ddf1515886"; 

    const lowerWalletAddress = wallet.toLowerCase();

    const { data } = await axios.get(
      `https://api.arenapro.io/token_balances_view?user_address=eq.${lowerWalletAddress}`
    );

    const tokens = data.map((t) => ({
      name: t.token_name,
      token_symbol: t.token_symbol,
      photo_url : t.photo_url,
      balance: t.balance
    }));

    return res
      .status(200)
      .send(Response.sendResponse(true, tokens, null, 200));
  } catch (error) {
    return res
      .status(500)
      .send(Response.sendResponse(false, null, error.message, 500));
  }
};


module.exports = {
    getUserWallet
}