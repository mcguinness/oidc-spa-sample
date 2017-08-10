const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const yargs = require('yargs');
const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const passport = require('passport');
const JwtBearerStrategy = require('passport-oauth2-jwt-bearer').Strategy;
const request = require('request');

/**
 * Arguments
 */

console.log();
console.log('loading configuration...');
var argv = yargs
  .usage('\nSimple OAuth 2.0 protected resource server\n\n' +
      'Usage:\n\t$0 -iss {url} -aud {uri}', {
    port: {
      description: 'Web server listener port',
      required: true,
      alias: 'p',
      default: 8080
    },
    issuer: {
      description: 'Access Token Issuer URL',
      required: true,
      alias: ['iss', 'orgUrl']
    },
    audience: {
      description: 'Access Token Audience URI',
      required: true,
      alias: ['aud', 'clientId']
    },
    widgetScopes: {
      array: true,
      description: 'Scopes for the Okta Sign-In Widget to request'
    },
    scope: {
      description: 'OAuth 2.0 Scope for Protected Resource',
      alias: ['scp', 'protectedScope'],
    },
    apiToken: {
      description: 'Okta Organization SSWS API Token for Social IdP Callbacks',
      alias: 'ssws',
    },
    authzIssuer: {
      description: 'Alternate Authorization URL',
    },
    idp: {
      description: 'Okta ID for the Social IdP',
    }
  })
  .config()
  .example('\t$0 --iss https://example.okta.com --aud ANRZhyDh8HBFN5abN6Rg', '')
  .env('')
  .argv;

console.log();
console.log('Listener Port:\n\t' + argv.port);
console.log('Issuer URL:\n\t' + argv.issuer);
console.log('Audience URI:\n\t' + argv.audience);

const issuerUrl = url.parse(argv.issuer);
const metadataUrl = argv.issuer + '/.well-known/openid-configuration';
const orgUrl = issuerUrl.protocol + '//' + issuerUrl.host + (issuerUrl.port ? ':' + issuerUrl.port : '');

console.log('Metadata URL:\n\t' + metadataUrl);
console.log('Organization URL:\n\t' + orgUrl);
console.log();

/**
 * Globals
 */

const app = express();
const httpServer = http.createServer(app);
const imgString = new Buffer(
  fs.readFileSync(path.join(__dirname, './images/oauth2.png'))
).toString('base64');
const sessionHandler = require('express-session')({
  secret: 'if you don\t know, now you know',
  resave: true,
  saveUninitialized: true
});

app.enable('trust proxy');

/**
 * Middleware
 */
app.set('port', argv.port);
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use('/', express.static(__dirname));
app.use(bodyParser.json());
app.use(helmet())
app.use(passport.initialize());

/**
 * Routes
 */

app.get('/js/config.js', sessionHandler, function(req, res, next) {
  res.setHeader('Content-Type', 'application/javascript');
  return res.render('config', {argv: argv});
});

app.get('/welcome', sessionHandler, function(req, res, next) {
  var thisAppUrl = req.protocol + "://" + req.headers.host
  
  return res.render('welcome', {
    thisAppUrl: thisAppUrl,
    oktaAdminOrg: argv.issuer.replace('.', '-admin.'),
    argv: argv
  });
});

app.get('/social/callback', sessionHandler, function(req, res, next) {
  const txId = req.query.tx_id;
  console.log('Fetching IdP transaction %s', txId);
  if (txId) {
    request({
      method: 'GET',
      json: true,
      uri: orgUrl + '/api/v1/idps/tx/' + txId + '/target',
      headers: {
        'authorization': 'SSWS ' + argv.apiToken
      }
    }, function(txErr, txRes, txBody) {
      if (txErr || txRes.statusCode < 200 || txRes.statusCode >= 300) {
        console.log('Unable to fetch IdP transaction %s due to HTTP Error: %s ', txId, txErr || txRes.statusCode);
      } else {
        console.log('IdP transaction: %j', txBody)
        req.session.tx = {
          id: txId,
          profile: txBody.profile
        }
        return res.render('register', {
          profile: txBody.profile,
        });
      }
    });
  }
});

app.post('/social/callback', [bodyParser.urlencoded({extended: false}), sessionHandler], function(req, res, next) {
  if (req.session.tx) {
    const txId = req.session.tx.id;
    const profile = {
      customerId: req.body.customerId,
      streetAddress: req.body.streetAddress,
      city: req.body.city,
      zipCode: req.body.postalCode
    };

    console.log('Registering additional profile %j for IdP transaction %s', profile, txId);

    request({
      method: 'POST',
      json: true,
      uri: orgUrl + '/api/v1/idps/tx/' + txId + '/lifecycle/provision',
      headers: {
        'authorization': 'SSWS ' + argv.apiToken
      },
      body: {
        profile: profile
      }
    }, function(txErr, txRes, txBody) {
      if (txErr || txRes.statusCode < 200 || txRes.statusCode >= 300) {
        console.log('Unable to fetch IdP transaction %s due to HTTP Error: %s ', txId, txErr || txRes.statusCode);
      } else {
        console.log('registration response %j', txBody);

        if (txBody.status === 'SUCCESS') {
          req.session.destroy();
          return res.render('finish', {
            url: orgUrl + '/api/v1/idps/tx/' + txId + '/finish',
            sessionToken: txBody.sessionToken
          });
        } else {
          return res.json(txBody);
        }
      }
    });
  }
});

app.get('/claims',
  passport.authenticate('oauth2-jwt-bearer', { session: false }),
  function(req, res) {
    res.json(req.user);
  });

app.get('/protected',
  passport.authenticate('oauth2-jwt-bearer', { scopes: argv.scope, session: false }),
  function(req, res) {
    console.log('Accessing protected resource as ' + req.user.sub);
    res.set('Content-Type', 'application/x-octet-stream');
    res.send(imgString);
  });

/**
 * Fetch metadata to obtain JWKS signing keys
 */

console.log('fetching issuer metadata configuration from %s...', metadataUrl);
request({
  json: true,
  uri: metadataUrl,
  strictSSL: true
}, function(err, res, body) {
  if (err || res.statusCode < 200 || res.statusCode >= 300) {
    console.log('Unable to fetch issuer metadata configuration due to HTTP Error: %s ', res.statusCode);
    return process.exit(1);
  }

/**
 * Configure JwtBearerStrategy with JWKS
 */

 console.log('trusting tokens signed with keys from %s...', res.body.jwks_uri);
  passport.use(new JwtBearerStrategy({
    issuer: argv.issuer,
    audience: argv.audience,
    realm: 'OKTA',
    jwksUrl: res.body.jwks_uri
  }, function(token, done) {
    // done(err, user, info)
    return done(null, token);
  }));

/**
 * Start Server
 */

  console.log();
  console.log('starting server...');
  httpServer.listen(app.get('port'), function() {
    var scheme   = argv.https ? 'https' : 'http',
        address  = httpServer.address(),
        hostname = os.hostname();
        baseUrl  = address.address === '0.0.0.0' ?
          scheme + '://' + hostname + ':' + address.port :
          scheme + '://localhost:' + address.port;

    console.log('listening on port: ' + app.get('port'));
    console.log();
  });

});
