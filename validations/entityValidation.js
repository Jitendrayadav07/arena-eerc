const Joi = require("joi");

const registerEntitySchema = {
  registerEntityValidation: Joi.object().keys({
    email_id: Joi.string().required(),
    name: Joi.string().required(),
    entity_type: Joi.string().optional(),
    base_token: Joi.string().optional(),
  }),

  transferEntityWalletValidation: Joi.object().keys({
    from_wallet_address: Joi.string().required(),
    to_wallet_address: Joi.string().required(),
    amount: Joi.number().positive().required(),
  }),

  transferTokenValidation: Joi.object().keys({
    entity_id: Joi.number().required(),
    tokenType: Joi.string().valid('AVAX', 'USDC', 'eUSDC', 'avax', 'usdc', 'eusdc').required()
      .messages({
        'any.only': 'tokenType must be one of: AVAX, USDC, eUSDC'
      }),
    recipient: Joi.string().required(),
    amount: Joi.number().positive().required()
      .messages({
        'number.positive': 'Valid amount is required'
      }),
  }),
};
module.exports = registerEntitySchema;
