const jwt = require("jsonwebtoken");
const { JWT_EERCx402_SECRET } = require("../config/jwtTokenKey");

function generateUserToken(entity, entity_wallet) {
    return jwt.sign(
        {
            entity_id: entity.entity_id,
            email_id: entity.email_id,
            api_key: entity.api_key,
            address: entity_wallet.address,
            encrypted_private_key: entity_wallet.encrypted_private_key
        },
        JWT_EERCx402_SECRET,
        { expiresIn: "23h" }
    );
}

module.exports = { generateUserToken };