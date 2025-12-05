const Joi = require("joi");

const registerEntitySchema = {
  registerEntityValidation: Joi.object().keys({
    email_id : Joi.string().required(),
    name: Joi.string().required(),
  }),

  transferEntityWalletValidation: Joi.object().keys({
    from_wallet_address: Joi.string().required(),
    to_wallet_address: Joi.string().required(),
    amount: Joi.number().positive().required(),
  }),
};
module.exports = registerEntitySchema;
