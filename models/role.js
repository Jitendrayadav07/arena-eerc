//models/role.js
module.exports = (sequelize , DataTypes) => {
    const Role = sequelize.define('role', {
      id: {
        type: DataTypes.INTEGER(11),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      role_name:{
          type: DataTypes.STRING
      }
    },{
      timestamps: true,
      underscored: true
    });
    return Role;
}
