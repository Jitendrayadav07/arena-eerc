const Joi = require('joi') 

const roleSchema = { 
  createRole: Joi.object().keys({ 
    role_name: Joi.string().required(),
  }),

  getRole: Joi.object().keys({
    id: Joi.number().min(1).required() 
  }),

  putRole: Joi.object().keys({
    id: Joi.number().min(1)
  }),
  

  deleteRole: Joi.object().keys({
    id: Joi.number().min(1).required() 
  })
}; 
module.exports = roleSchema;