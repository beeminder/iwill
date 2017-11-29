// --------------------------------- 80chars ---------------------------------->

import app from './express'
import APP_DOMAIN from '../data/config'
import { users } from '../data/seed'
import Promises, { sequelize } from '../models/promise'
import Users from '../models/user'
import parsePromise from '../lib/parse/promise'
import mailself from '../lib/mail'
import { logger } from '../lib/logger'

// validates all requests with a :user param
app.param('user', function(req, res, next, id) {
  console.log('user check')
  if (!users.includes(id)) {
    return res.redirect('/sign-up')
  }
  next()
})

// user promises list

app.get('/:user.(commits.to|promises.to)', (req, res) => {
  console.log('user promises', req.params.user)
  
  const u = Users.findOne({  }) //where: { id: req.params.user }
    .then(user => {
      console.log('getPromises', user)
      if(user) {
        user.getPromises().then(promises => {
          console.log('getPromises promises', promises)
        })
      }
    })
  console.log('user list', u)
  
  Promises.findAll({
    where: {
      userId: req.params.user,
      // [sequelize.Op.not]: [
      //   { tfin: null },
      // ],
    },
    order: sequelize.literal('tdue DESC'),
  }).then(function(promises) {
    console.log(`${req.params.user}'s promises:`, promises.length)
    
    // FIXME should be able to do this with one query
    // TODO also find & calculate overdue promises
    Promises.findAll({
      where: {
        userId: req.params.user,
        [sequelize.Op.not]: [
          { tfin: null },
        ],
      },
      attributes: [[sequelize.fn('AVG', sequelize.col('cred')), 'reliability']],
    }).then(rels => {
      res.render('user', { 
        promises,
        username: req.params.user,
        reliability: rels[0].dataValues.reliability
      })
    })
  })
})

// promise parsing middleware
app.get('/:user.(commits.to|promises.to)/:promise/:modifier?/:date*?', (req, res, next) => {
  const parsedPromise = parsePromise({ urtext: req.originalUrl, ip: req.ip })
    .then(parsedPromise => {
      req.parsedPromise = parsedPromise // add to the request object that is passed along
      
      console.log('promise middleware', req.ip, req.parsedPromise.id)
      
      const { id, user } = parsedPromise
      if (users.includes(user)) {
        Promises.findOne({ where: { id } })
          .then((promise) => {
            if (promise) {
              console.log('promise exists', promise.dataValues)
              promise.increment(['clix'], { by: 1 }).then(updated => {
                console.log('clix incremented', updated.id)
                return next()
              })
            } else {
              // TODO track IP address created from
              Promises.create(parsedPromise)
                .then(promise => {
                  console.log('promise created', promise)
                  mailself('PROMISE', promise.urtext) // send dreeves@ an email 
                  return next()
                })
            }
          })
      } else {
       return next() 
      }
    })
    .catch((reason) => { // unparsable promise
      console.log('promise parsing error', reason)
      res.redirect('/')
    })
})

// edit promise (this has to come before the show route, else it's ambiguous)
app.get('/:user.(commits.to|promises.to)/:urtext*?/edit', (req, res, next) => {
  const { parsedPromise: { id, user } = {} } = req
  console.log('edit promise', id)
  Promises.findOne({ where: { id } }).then((promise) => res.render('edit', { promise }))
})

// show promise
app.get('/:user.(commits.to|promises.to)/:urtext(*)', (req, res, next) => {
  const { parsedPromise: { id, user }  = {}} = req
  Promises.findOne({ where: { id } }).then((promise) => {
    console.log('show promise', id)
    res.render('show', { promise })
  })
})

// home
app.get(['/?', '/((www.)?)promises.to/?', '/((www.)?)commits.to/?'], (req, res) => {
  Promises.findAll({
    // where: { tfin: null }, // only show uncompleted promises on the homepage
    // limit: 30
    order: sequelize.literal('tini DESC'),
  }).then(function(promises) {
    console.log('WTF glitch?!?')
    res.render('home', {
      promises
    })
  })
})

// placeholder
app.get('/sign-up', (req, res) => { console.log('WTF glitch?!?'); res.render('signup') })

// --------------------------------- 80chars ---------------------------------->