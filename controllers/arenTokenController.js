const Response = require("../classes/Response");
const db = require("../config/db.config");
const { getTokenBalance, getTokenUsdPrice } = require("../services/tokenService")

const getTreasuryTokens = async (req, res) => {
    try {
        const wallet_address = "0x94a27A070aE4ed87e5025049a407F8ddf1515886";
        const tokenData = await db.tbl_arena_tokens.findAll({});

        // Fetch all balances and prices in parallel
        const results = await Promise.all(
            tokenData.map(async (token) => {
                try {
                    const contractAddress = token.contract_address.toLowerCase();
                    const tokenDetails = await getTokenBalance(contractAddress, wallet_address);
                    const balanceNum = parseFloat(tokenDetails.balance) || 0;
                    let price = 0;
                    let value = 0;

                    if (balanceNum > 0) {
                        price = await getTokenUsdPrice(contractAddress);
                        value = balanceNum * price;
                    }

                    return {
                        token_name: token.name,
                        token_symbol: tokenDetails.symbol,
                        token_contract_address: contractAddress,
                        balance: balanceNum,
                        price,
                        value,
                        photo_url: token.photo_url,
                        pair_address: null,
                        registrationVerifier: token.registrationVerifier,
                        mintVerifier: token.mintVerifier,
                        withdrawVerifier: token.withdrawVerifier,
                        transferVerifier: token.transferVerifier,
                        burnVerifier: token.burnVerifier,
                        babyJubJub: token.babyJubJub,
                        registrar: token.registrar,
                        encryptedERC: token.encryptedERC
                    };
                } catch (err) {
                    console.error(`Error fetching data for ${contractAddress}:`, err.message);
                    return null;
                }
            })
        );

        // Filter successful ones and sort
        const response = results.filter(Boolean).sort((a, b) => b.balance - a.balance);

        return res.status(200).send(Response.sendResponse(true, response, null, 200));
    } catch (err) {
        console.error("Error in getTreasuryTokens:", err);
        return res
            .status(500)
            .send(Response.sendResponse(false, null, "Error occurred while fetching treasury tokens", 500));
    }
};

const getEercTokenVerified = async (req, res) => {
    try {
        let response = await db.tbl_arena_tokens.findAll({
            where: {
                is_eerc: 1,
                is_auditor: 1
            },
            order: [["createdAt", "DESC"]]
        });
        return res.status(200).send(Response.sendResponse(true, response, null, 200));
    } catch (err) {
        return res.status(500).send(Response.sendResponse(false, null, "Error occurred while fetching EERC token verified", 500));
    }
}

module.exports = {
    getTreasuryTokens,
    getEercTokenVerified
}