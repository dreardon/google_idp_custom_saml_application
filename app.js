var http = require('http');
var os = require('os');
var fs = require('fs');
var express = require("express");
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var passport = require('passport');
var saml = require('@node-saml/passport-saml');

require('dotenv').config()

var app = express();
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/static'));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

var samlStrategy = new saml.Strategy({
  callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:8080/login/callback',
  entryPoint: process.env.SAML_ENTRY_POINT,
  issuer: process.env.SAML_ISSUER || 'http://localhost:8080',
  cert: fs.readFileSync(__dirname + '/cert/idp_cert.pem', 'utf8'),
  wantAuthnResponseSigned: false,
  additionalParams: {"AdditionalParamsKey":"AdditionalParamsValue"},
  additionalAuthorizeParams: {"additionalAuthorizeParamsKey":"additionalAuthorizeParamsValue"}
  }, 
  function(profile, done) {
    console.log('profile');
    console.log(JSON.stringify(profile))
    return done(null, profile); 
  }
);

passport.use(samlStrategy);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(session({secret: process.env.SESSION_SECRET}));
app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
  console.log('Check if authenticated')
  if (req.isAuthenticated())
    return next();
  else
    return res.redirect('/login');
}

app.get('/',
  function(req, res) {
    res.render('pages/index');
  }
);

app.get('/home',
  ensureAuthenticated, 
  function(req, res) {
    res.render('pages/home', {profile: req.user});
  }
);

app.get('/login',
  passport.authenticate('saml', { failureRedirect: '/login/fail' }),
  function (req, res) {
    res.redirect('/home');
  }
);

app.post("/login/callback",
  passport.authenticate("saml", {
    failureRedirect: '/login/fail',
    failureFlash: true,
  }),
  function (req, res) {
    res.redirect("/home");
  }
);

app.get('/login/fail', 
  function(req, res) {
    res.status(401).send('Login failed');
  }
);

app.get('/metadata',
    function(req, res) {
        res.type('application/xml'); 
        res.status(200).send(
          samlStrategy.generateServiceProviderMetadata(
             fs.readFileSync(__dirname + '/cert/privateKey.key', 'utf8'), 
             fs.readFileSync(__dirname + '/cert/privateKey.key', 'utf8')
          )
        );
    }
);

//general error handler
app.use(function(err, req, res, next) {
  console.log("Fatal error: " + JSON.stringify(err));
  next(err);
});

var server = app.listen(8080, function () {
  console.log('Listening on port %d', server.address().port)
});