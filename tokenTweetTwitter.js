const cron = require('node-cron');
const Response = require("./classes/Response");
const db = require("./config/db.config");
const axios = require("axios");
const { twitterClient } = require("./twitterClient");

// Function to create HTML template for token
const createTokenHTMLTemplate = (token) => {
    const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 15px; color: white;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">🚀 New EERC Token Alert!</h2>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; backdrop-filter: blur(10px);">
            <h3 style="margin: 0 0 10px 0; color: #FFD700; font-size: 20px;">${token.name || 'Unknown Token'}</h3>
            <p style="margin: 5px 0; font-size: 16px;"><strong>Symbol:</strong> ${token.symbol || 'N/A'}</p>
            <p style="margin: 5px 0; font-size: 14px; word-break: break-all;"><strong>Contract:</strong> ${token.contract_address || 'N/A'}</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; backdrop-filter: blur(10px);">
            <h4 style="margin: 0 0 10px 0; color: #FFD700;">📊 Token Details</h4>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Creator:</strong> ${token.creator_address || 'N/A'}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Pair Address:</strong> ${token.pair_address ? token.pair_address.substring(0, 10) + '...' : 'N/A'}</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; backdrop-filter: blur(10px);">
            <h4 style="margin: 0 0 10px 0; color: #FFD700;">🔐 EERC Features</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <span style="background: rgba(0,255,0,0.3); padding: 5px 10px; border-radius: 15px; font-size: 12px;">✅ EERC Enabled</span>
                <span style="background: rgba(0,255,0,0.3); padding: 5px 10px; border-radius: 15px; font-size: 12px;">✅ Auditor Verified</span>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">Powered by Arena EERC Platform</p>
        </div>
    </div>
    `;
    
    return htmlTemplate;
};

// Function to post token to Twitter
const postTokenToTwitter = async (token) => {
    try {
        const htmlTemplate = createTokenHTMLTemplate(token);
        
        // Create tweet text (Twitter doesn't support HTML, so we'll create a text version)
        const tweetText = `🚀 New EERC Token Listing Alert!

📊 ${token.name || 'Unknown Token'} (${token.symbol || 'N/A'})
🔗 Contract: ${token.contract_address || 'N/A'}
👤 Creator: ${token.creator_address || 'N/A'}

✅ EERC Enabled
✅ Auditor Verified

#EERC #Crypto #Token #Blockchain #Arena`;

        // Post to Twitter
        const tweet = await twitterClient.v2.tweet({
            text: tweetText
        });

        console.log(`Successfully posted token ${token.name} to Twitter:`, tweet.data.id);
        
        // Update the token as tweeted
        await db.tbl_arena_tokens.update(
            { is_tweeted: 1 },
            { where: { id: token.id } }
        );
        
        return { success: true, tweetId: tweet.data.id, htmlTemplate };
    } catch (error) {
        console.error(`Error posting token ${token.name} to Twitter:`, error);
        return { success: false, error: error.message };
    }
};

const tokenTweetTwitter = async () => {
    try {
        const tokens = await db.tbl_arena_tokens.findAll({
            where: {
                is_eerc: 1,
                is_auditor: 1,
                is_tweeted: 0
            }
        });
        
        console.log(`Found ${tokens.length} tokens to tweet`);
        
        if (tokens.length === 0) {
            console.log("No new tokens to tweet");
            return;
        }
        
        // Process each token
        for (const token of tokens) {
            console.log(`Processing token: ${token.name} (ID: ${token.id})`);
            
            const result = await postTokenToTwitter(token);
            
            if (result.success) {
                console.log(`✅ Successfully posted ${token.name} to Twitter`);
                console.log(`📄 HTML Template generated for ${token.name}`);
            } else {
                console.error(`❌ Failed to post ${token.name}: ${result.error}`);
            }
            
            // Add a small delay between tweets to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log("Finished processing all tokens");
        
    } catch (error) {
        console.error("Error in tokenTweetTwitter:", error);
    }
}

// Export functions for external use
module.exports = {
    tokenTweetTwitter,
    createTokenHTMLTemplate,
    postTokenToTwitter,
    cron
};

// Uncomment the line below to run the function immediately for testing
tokenTweetTwitter();

// Uncomment the line below to schedule the function to run every minute
cron.schedule('* * * * *', tokenTweetTwitter);