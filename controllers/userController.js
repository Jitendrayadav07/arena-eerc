const Response = require("../classes/Response");
const db = require("../config/db.config");
const { getTokenBalance, getTokenUsdPrice } = require("../services/tokenService")

const getUserWallet = async (req, res) => {
  try {
    const wallet = req.query.wallet;
    const wallet_address = wallet.toLowerCase();

    const tokenData = await db.tbl_arena_tokens.findAll({
      where: {
        is_eerc: 1,
        is_auditor: 1
      },
      raw: true
    });
 
    const tokens = await Promise.all(
      tokenData.map(async (token) => {
        try {
          let contractAddress = token.contract_address.toLowerCase();
          const tokenDetails = await getTokenBalance(contractAddress, wallet_address);
          const balanceNum = parseFloat(tokenDetails.balance) || 0;
          let price = 0;
          let value = 0;

          if (balanceNum > 0) {
            price = await getTokenUsdPrice(contractAddress);
            value = balanceNum * price;
          }


          return {
            name: token.token_name || token.name || "",
            token_symbol: token.symbol || "",
            photo_url: token.photo_url || "",
            balance: balanceNum,
            price,
            value
          };
        } catch (err) {
          console.error(`Error fetching data for token ${token.contract_address}:`, err.message);
          return null;
        }
      })
    );

    // Remove null entries
    const filteredTokens = tokens.filter(Boolean);

    filteredTokens.sort((a, b) => b.value - a.value);

    return res
      .status(200)
      .send(Response.sendResponse(true, filteredTokens, null, 200));

  } catch (error) {
    console.error("getUserWallet Error:", error);
    return res
      .status(500)
      .send(Response.sendResponse(false, null, error.message, 500));
  }
};

module.exports = {
  getUserWallet
}