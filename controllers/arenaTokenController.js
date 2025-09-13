const Response = require("../classes/Response");
const db = require("../config/db.config");
const axios = require("axios");
const { ethers } = require("ethers");

// Utility function to fetch Arena Pro tokens from API
const fetchArenaProTokensFromAPI = async (search = null, order = 'latest_price_usd.desc', limit = 20) => {
    try {
        let apiUrl = 'https://api.arenapro.io/tokens_view?';
        
        if (search) {
            const searchParam = `or=(creator_twitter_handle.ilike.*${search}*,creator_address.ilike.*${search}*,token_contract_address.ilike.*${search}*,token_name.ilike.*${search}*,token_symbol.ilike.*${search}*)`;
            apiUrl += searchParam + '&';
        }
        
        apiUrl += `order=${order}&limit=${limit}`;

        const response = await axios.get(apiUrl);
        return response.data;
        
    } catch (error) {
        console.error('Error fetching Arena Pro tokens:', error.message);
        return error.message;
    }
};

const createArenaToken = async (req, res) => {
    try {
        const { contract_address, name, symbol, status, creator_address, pair_address, photo_url, is_eerc } = req.body;
        
        let wallet_address = '0x94a27A070aE4ed87e5025049a407F8ddf1515886'

        const arenaProTokenBalances = await getArenaProTokenBalances(wallet_address);
        console.log("Arena Pro Token Balances:", arenaProTokenBalances);
        
        // Fetch Arena Pro token data for the specific contract address
        const arenaProData = await fetchArenaProTokensFromAPI(contract_address, 'latest_price_usd.desc', 1);
        console.log("arenaProData:", arenaProData);

        let arenaToken = null;
        if(arenaProData.length > 0){
            arenaToken = await db.tbl_arena_tokens.create({ 
                contract_address, 
                name, 
                symbol, 
                status, 
                creator_address, 
                pair_address, 
                photo_url
            });
            console.log("Created token in database:", arenaToken);
        } else {
            console.log("No Arena Pro data found, token not created");
        }

        const responseData = {
            arenaToken: arenaToken,
            arenaProData: arenaProData,
            message: arenaToken ? "Token created successfully" : "No Arena Pro data found, token not created"
        };

        return res.status(200).json(Response.sendResponse(true, responseData, "Arena token processed successfully", 200));
    } catch (error) {
        return res.status(500).json(Response.sendResponse(false, null, error.message, 500));
    }
}

// Function to get Arena Pro token balances for a wallet address
const getArenaProTokenBalances = async (wallet_address) => {
    try {
        
        if (!wallet_address) {
            return "Wallet address is required";
        }

        // Validate wallet address format
        if (!ethers.isAddress(wallet_address)) {
            return "Invalid wallet address format";
        }

        // Fetch token balances from Arena Pro API
        // Convert wallet address to lowercase as the API expects it
        const lowerWalletAddress = wallet_address.toLowerCase();
        const balanceUrl = `https://api.arenapro.io/token_balances_view?user_address=eq.${lowerWalletAddress}`;
        
        console.log("Fetching from URL:", balanceUrl);
        const response = await axios.get(balanceUrl);
        const tokenBalances = response.data;
        
        console.log("API Response:", tokenBalances);
        
        if (!tokenBalances || tokenBalances.length === 0) {
            return {
                wallet_address,
                total_tokens: 0,
                total_value_usd: 0,
                holdings: []
            };
        }

        // Calculate total portfolio value
        let totalValueUSD = 0;
        const holdings = tokenBalances.map(token => {
            const tokenValue = token.balance * token.latest_price_usd;
            totalValueUSD += tokenValue;
            
            return {
                token_name: token.token_name,
                token_symbol: token.token_symbol,
                token_contract_address: token.token_contract_address,
                balance: token.balance,
            };
        });

        // Sort by value descending
        holdings.sort((a, b) => b.balance - a.balance);

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


module.exports = {
    createArenaToken,
    getArenaProTokenBalances
}