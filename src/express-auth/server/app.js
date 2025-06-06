'use strict'

/**
 * Module dependencies.
 */

const express = require('express');
const hash = require('pbkdf2-password')()
const path = require('node:path');
const session = require('express-session');
const cookieParser = require('cookie-parser')
const cors = require("cors")

const app = module.exports = express();

// config

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware

app.use(cookieParser())
app.use(express.urlencoded())
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

// Session-persisted message middleware

app.use(function (req, res, next) {
  let err = req.session.error;
  let msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

// dummy database

const users = [

]

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)

hash({ password: 'foobar' }, function (err, pass, salt, hash) {
  if (err) throw err;
  // store the salt & hash in the "db"
  users.push({
    name: "tj",
    salt,
    hash
  })
});


// Authenticate using our plain-object database of doom!

function registerNewuser(name, pass, fn) {
  // if (!module.parent) console.log('Registering %s:%s', name, pass);
  let user = users.find(user => user.name === name);
  if (user)
    return fn(null, null)

  hash({ password: pass }, function (err, pass, salt, hash) {
    if (err) throw err;
    // store the salt & hash in the "db"
    users.push({
      name,
      salt,
      hash
    })
  })
}

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  let user = users.find(user => user.name === name);
  // query the db for the given username
  if (!user) return fn(null, null)
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
    if (err) return fn(err);
    if (hash === user.hash) return fn(null, user)
    fn(null, null)
  });
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', function (req, res) {
  res.redirect('/login');
});

app.get('/restricted', restrict, function (req, res) {
  console.log("restricted: ", req.cookies)
  res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
});

app.get('/logout', function (req, res) {
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function () {
    res.redirect('/');
  });
});

app.get('/login', function (req, res) {
  res.render('login');
});

app.get("/register", (req, res) => {
  res.render("register")
})

function handle(req, res, err, user) {
  if (err) return next(err)
  if (user) {
    // Regenerate session when signing in
    // to prevent fixation
    req.session.regenerate(function () {
      // Store the user's primary key
      // in the session store to be retrieved,
      // or in this case the entire user object
      req.session.user = user;
      req.session.success = 'Authenticated as ' + user.name
        + ' click to <a href="/logout">logout</a>. '
        + ' You may now access <a href="/restricted">/restricted</a>.';
      res.redirect(req.get('Referrer') || '/');
    });
  } else {
    req.session.error = 'Authentication failed, please check your '
      + ' username and password.'
      + ' (use "tj" and "foobar")';
    res.redirect('/login');
  }
}

app.post("/register", (req, res) => {
  if (!req.body) return res.sendStatus(400)

  const { username, password } = req.body;
  registerNewuser(username, password, (err, user) => handle(req, res, err, user))
  res.redirect('/login');
})

app.post('/login', function (req, res, next) {
  if (!req.body) return res.sendStatus(400)
  // console.log({ users })
  const { username, password } = req.body;
  authenticate(username, password, (err, user) => handle(req, res, err, user))
})

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
