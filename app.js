'use strict';

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo')(session);
const nconf = require('nconf');
const util = require('util');
const logger = require('./lib/logger.js');
//security middleware
const helmet = require('helmet');
const cors = require('cors');

// routes
const index = require('./lib/routes/index');
const users = require('./lib/routes/users');

nconf
    .argv()
    .env()
    .file({file: './config.json'});

// Use native Node promises
mongoose.Promise = global.Promise;
// connect to MongoDB
mongoose
    .connect(nconf.get('mongodb_uri'), {useMongoClient: true})
    .catch((err) => console.error(err));

const app = express();
app.use(cors());

app.set('trust proxy', true);
app.use(helmet());
//use sessions for tracking logins
app.use(session({
  secret: 'no pain no gain',
  resave: true,
  saveUninitialized: false,
  store: new MongoStore({
    mongooseConnection: mongoose.connection
  })
}));

app.use(morgan('combined', {
  skip: function(req, res) {
    return res.statusCode < 400;
  }, stream: process.stderr
}));

app.use(morgan('combined', {
  skip: function(req, res) {
    return res.statusCode >= 400;
  }, stream: process.stdout
}));

app.locals.inspect = util.inspect;
app.locals._ = require('underscore');
app.locals._.str = require('underscore.string');
app.locals.moment = require('moment');

app.set('views', path.join(__dirname, '/lib/views'));
app.set('view engine', 'pug');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(expressValidator());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/get-youtube-id', express.static(__dirname + '/node_modules/get-youtube-id'));

app.use((req, res, next) => {
  res.locals.userId = req.session.userId;
  res.locals.user = req.session.user;
  res.locals.baseUrl = req.protocol + '://' + req.get('host');
  res.locals.currentUrl = res.locals.baseUrl + req.originalUrl;
  next();
});

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  let err = new Error('Not Found');
  err.status = 404;
  return next(err);
});

app.use(clientErrorHandler);

function clientErrorHandler(err, req, res, next) {
  if (req.xhr) {
    logger.error(err.message, err.stack);
    return res.status(500).send({error: err.message});
  }
  next(err);
}

app.use(errorhandler);

function errorhandler(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = app.get('env') === 'development' ? err : {};
  console.error(err.stack);
  logger.error(err.message, err.stack);
  res.status(err.status || 500);
  res.render('error');
}

module.exports = app;