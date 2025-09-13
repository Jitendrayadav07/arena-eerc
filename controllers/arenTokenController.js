const Response = require("../classes/Response");
const db = require("../config/db.config");
const axios = require("axios");
const { ethers } = require("ethers");


const getAllEercArenaTokens = async (req, res) => {
    try {
        let response = await db.tbl_arena_tokens.findAll(
            {
                where: {
                    is_eerc: 1,
                    is_auditor : 1
                }
            }
        );
        return res.status(200).send(Response.sendResponse(true,response,null,200));
    }catch(err){
        return res.status(500).send(Response.sendResponse(false,null,SHILL_CATEGORY_CONSTANTS_STATUS.ERROR_OCCURED,500));
    }
}

// Function to get Arena Pro token balances for a wallet address
const getArenaProTokenBalances = async (wallet_address) => {
    try {
        if (!wallet_address) {
            return "Wallet address is required";
        }

        if (!ethers.isAddress(wallet_address)) {
            return "Invalid wallet address format";
        }
        // Fetch token balances from Arena Pro API
        const lowerWalletAddress = wallet_address.toLowerCase();
        const balanceUrl = `https://api.arenapro.io/token_balances_view?user_address=eq.${lowerWalletAddress}`;

        const response = await axios.get(balanceUrl);
        const tokenBalances = response.data;

        if (!tokenBalances || tokenBalances.length === 0) {
            return {
                wallet_address,
                total_tokens: 0,
                total_value_usd: 0,
                holdings: []
            };
        }

        // Calculate total portfolio value and format data
        let totalValueUSD = 0;
        const holdings = tokenBalances.map(token => {
            const tokenValue = token.balance * token.latest_price_usd;
            totalValueUSD += tokenValue;
            
            return {
                token_name: token.token_name,
                token_symbol: token.token_symbol,
                token_contract_address: token.token_contract_address,
                balance: token.balance,
                price: token.latest_price_usd,
                value: tokenValue,
                photo_url: token.photo_url,
                creator_address: token.creator_address,
                pair_address: token.pair_address
            };
        });

        // Sort by value descending
        holdings.sort((a, b) => b.value - a.value);

        const responseData = {
            wallet_address,
            total_tokens: holdings.length,
            total_value_usd: totalValueUSD.toFixed(2),
            holdings: holdings
        };
        
        return responseData;
        
    } catch (error) {
        console.error('Error in getArenaProTokenBalances:', error.message);
        return error.message;
    }
}

const getTreasuryTokens = async (req, res) => {
    try {
        const wallet_address = '0x94a27A070aE4ed87e5025049a407F8ddf1515886';
        
        const tokenData = await getArenaProTokenBalances(wallet_address);
        console.log("tokenData",tokenData)
        if (typeof tokenData === 'string') {
            return res.status(400).send(Response.sendResponse(false, null, tokenData, 400));
        }
        
        return res.status(200).send(Response.sendResponse(true, tokenData, null, 200));
    } catch (err) {
        console.error('Error in getTreasuryTokens:', err);
        return res.status(500).send(Response.sendResponse(false, null, "Error occurred while fetching treasury tokens", 500));
    }
}

module.exports = {
    getAllEercArenaTokens,
    getTreasuryTokens
}