const jwt = require("jsonwebtoken");
const { JWT_EERCx402_SECRET } = require("../config/jwtTokenKey");

function generateSubEntityToken(sub_entity, entity_wallet) {
    return jwt.sign(
        {
            sub_entity_id: sub_entity.sub_entity_id,
            email_id: sub_entity.email_id,
            api_key: sub_entity.api_key,
            address: entity_wallet.address,
            encrypted_private_key: entity_wallet.encrypted_private_key
        },
        JWT_EERCx402_SECRET,
        { expiresIn: "23h" }
    );
}

module.exports = { generateSubEntityToken };