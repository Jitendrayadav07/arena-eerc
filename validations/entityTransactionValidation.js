const Joi = require("joi");

const entityTransactionSchema = {
    getTransactionsByEntityIdValidation: Joi.object().keys({
        entity_id: Joi.number().required(),
        count: Joi.number(),
        offset: Joi.number(),
        sortBy: Joi.any(),
        orderBy: Joi.any().valid("asc", "desc"),
    }),

    getTransactionsByEmailIdValidation: Joi.object().keys({
        email_id: Joi.string().email().required(),
        count: Joi.number(),
        offset: Joi.number(),
        sortBy: Joi.any(),
        orderBy: Joi.any().valid("asc", "desc"),
    }),

    getDashboardDataValidation: Joi.object().keys({
        email_id: Joi.string().email().required(),
    }),

    getEntityBalanceValidation: Joi.object().keys({
        email_id: Joi.string().email().required(),
    }),

    getBalanceByWalletAddressValidation: Joi.object().keys({
        wallet_address: Joi.string().required(),
    })
};
module.exports = entityTransactionSchema;
