const cron = require('node-cron');
const Response = require("./classes/Response");
const db = require("./config/db.config");
const axios = require("axios");
const { ethers } = require("ethers");

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

const fetchArenaTokens = async () => {
    let wallet_address = '0x94a27A070aE4ed87e5025049a407F8ddf1515886'

    const arenaProTokenBalances = await getArenaProTokenBalances(wallet_address);

    for(let i = 0; i < arenaProTokenBalances.holdings.length; i++){
        const arenaProData = await fetchArenaProTokensFromAPI(arenaProTokenBalances.holdings[i].token_contract_address, 'latest_price_usd.desc', 1);
        if(arenaProData.length > 0 && arenaProTokenBalances.holdings[i].balance > 1000000){
            const existingToken = await db.tbl_arena_tokens.findOne({
                where: { contract_address: arenaProData[0].token_contract_address }
            });
            if (!existingToken) {
                const arenaToken = await db.tbl_arena_tokens.create({ 
                    contract_address: arenaProData[0].token_contract_address, 
                    name: arenaProData[0].token_name, 
                    symbol: arenaProData[0].token_symbol, 
                    creator_address: arenaProData[0].creator_address, 
                    pair_address: arenaProData[0].pair_address, 
                    photo_url: arenaProData[0].photo_url
                });
                console.log("Created new token in database:", arenaToken);
            } else {
                console.log("Token already exists, skipping:", arenaProData[0].token_name);
            }
        } else {
            console.log("No Arena Pro data found or balance too low, token not created");
        }
    }
};

cron.schedule('* * * * *', fetchArenaTokens);

module.exports = cron;