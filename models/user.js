// --------------------------------- 80chars ---------------------------------->
import Sequelize from 'sequelize'
import moment from 'moment-timezone'

import Promises, { sequelize } from './promise'

const Users = sequelize.define('users', {
  id: { // username
    type: Sequelize.STRING,
    primaryKey: true,
    unique: true,
  },
})

// all tables created
// sequelize.sync().then(() => {
  
// })

Users.hasMany(Promises)//, { foreignKey: 'user', sourceKey: 'name' })
Promises.belongsTo(Users)//, { as: 'user', foreignKey: 'user', targetKey: 'name' })  

// sequelize.authenticate()
//   .then(function(err) {
//     console.log('Database connection established')
//   })
//   .catch(function (err) {
//     console.log('Database connection error: ', err)
//   })

export default Users

// --------------------------------- 80chars ---------------------------------->
