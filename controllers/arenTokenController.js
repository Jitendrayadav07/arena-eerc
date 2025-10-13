const Response = require("../classes/Response");
const db = require("../config/db.config");
const axios = require("axios");
const { ethers } = require("ethers");

// Function to get token balance from smart contract
const getTokenBalance = async (contractAddress, walletAddress) => {
    try {
        // Create a provider (Avalanche C-Chain RPC)
        const provider = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
        
        // ERC-20 ABI for balanceOf function
        const erc20ABI = [
            "function balanceOf(address owner) view returns (uint256)"
        ];
        
        // Create contract instance
        const contract = new ethers.Contract(contractAddress, erc20ABI, provider);
        
        // Get balance
        const balanceWei = await contract.balanceOf(walletAddress);
        const balance = ethers.formatUnits(balanceWei, 18); // Assuming 18 decimals
        
        return balance;
    } catch (error) {
        console.error(`Error fetching balance for ${contractAddress}:`, error.message);
        return '0';
    }
};

const getTreasuryTokens = async (req, res) => {
    try {
        const wallet_address = '0x94a27A070aE4ed87e5025049a407F8ddf1515886';
        
        // Get tokens from database
        let tokenData = await db.tbl_arena_tokens.findAll();

        let response = [];

        for(let i = 0; i < tokenData.length; i++){
            const token = tokenData[i];
            let contractAddress = token.contract_address.toLowerCase();

            try {
                // Call Arena API for this specific token
                const arenaApiUrl = `https://api.arenapro.io/tokens_view?token_contract_address=eq.${contractAddress}`;
                const arenaResponse = await axios.get(arenaApiUrl);

                const arenaData = arenaResponse.data;

                if (arenaData && arenaData.length > 0) {
                    const balance = await getTokenBalance(contractAddress, wallet_address);
                    const price = parseFloat(arenaData[0].latest_price_usd) || 0;
                    const balanceNum = parseFloat(balance) || 0;
                    const value = balanceNum * price;

                    let obj = {
                        token_name: arenaData[0].token_name,
                        token_symbol: arenaData[0].token_symbol,
                        token_contract_address: contractAddress,
                        balance: balanceNum,
                        price: price,
                        value: value,
                        photo_url: arenaData[0].dexscreener_image_url || arenaData[0].photo_url,
                        pair_address: arenaData[0].pair_address,
                        registrationVerifier: token.registrationVerifier,
                        mintVerifier: token.mintVerifier,
                        withdrawVerifier: token.withdrawVerifier,
                        transferVerifier: token.transferVerifier,
                        burnVerifier: token.burnVerifier,
                        babyJubJub: token.babyJubJub,
                        registrar: token.registrar,
                        encryptedERC: token.encryptedERC
                    }
                    response.push(obj);
                } else {
                    console.log(`No Arena data found for ${contractAddress}`);
                }

            } catch (apiError) {
                console.error(`Error fetching Arena data for ${contractAddress}:`, apiError.message);
                continue;
            }
        }
        
        return res.status(200).send(Response.sendResponse(true,  response , null, 200));
        
    } catch (err) {
        console.error('Error in getTreasuryTokens:', err);
        return res.status(500).send(Response.sendResponse(false, null, "Error occurred while fetching treasury tokens", 500));
    }
}

const getEercTokenVerified = async (req, res) => {
    try {
        let response = await db.tbl_arena_tokens.findAll({
            where: {
                is_eerc: 1,
                is_auditor: 1
            }
        });
        return res.status(200).send(Response.sendResponse(true, response, null, 200));
    }catch(err){
        return res.status(500).send(Response.sendResponse(false, null, "Error occurred while fetching EERC token verified", 500));
    }
}

module.exports = {
    getTreasuryTokens,
    getEercTokenVerified
}