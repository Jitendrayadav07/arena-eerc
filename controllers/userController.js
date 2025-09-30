const Response = require("../classes/Response");
const db = require("../config/db.config");
const axios = require("axios");

const getUserWallet = async (req, res) => {
  try {
    const wallet = req.query.wallet; 
    const lowerWalletAddress = wallet.toLowerCase();

    const dbTokens = await db.tbl_arena_tokens.findAll({
      where: {
        is_eerc: 1,
        is_auditor: 1
      },
      raw: true
    });

    const { data } = await axios.get(
      `https://api.arenapro.io/token_balances_view?user_address=eq.${lowerWalletAddress}`
    );

    const tokens = data
      .filter(t => dbTokens.find(dbT => dbT.contract_address.toLowerCase() === t.token_contract_address.toLowerCase()))
      .map(t => ({
        name: t.token_name,
        token_symbol: t.token_symbol,
        photo_url: t.photo_url,
        balance: Number(t.balance),
        price: Number(t.latest_price_usd),
        value: Number(t.balance) * Number(t.latest_price_usd)
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