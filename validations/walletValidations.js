const Joi = require("joi");

const entityWalletSchema = {
  createEntityWalletValidation: Joi.object().keys({
    entity_id: Joi.number().required(),
  }),

};
module.exports = entityWalletSchema;
