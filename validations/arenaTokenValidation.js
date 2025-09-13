const Joi = require('joi');

const arenaTokenValidation = {
    fetchArenaProTokens: {
        query: Joi.object({
            search: Joi.string().optional().allow(''),
            order: Joi.string().optional().valid(
                'latest_price_usd.desc',
                'latest_price_usd.asc',
                'latest_total_volume_usd.desc',
                'latest_total_volume_usd.asc',
                'latest_holder_count.desc',
                'latest_holder_count.asc',
                'create_time.desc',
                'create_time.asc'
            ).default('latest_price_usd.desc'),
            limit: Joi.number().integer().min(1).max(100).optional().default(20)
        })
    },
};

module.exports = arenaTokenValidation