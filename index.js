// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var parseExpressHttpsRedirect = require('parse-express-https-redirect');
//var parseExpressCookieSession = require('parse-express-cookie-session');

var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');

var databaseUri = 'mongodb://admin:calypso@ds011409.mlab.com:11409/shapric-test';
//var databaseUri = process.env.DATABASE_URI || process.env.MONGOLAB_URI;

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var api = new ParseServer({
  databaseURI: 'mongodb://admin:calypso@ds011409.mlab.com:11409/shapric-test',
  cloud: __dirname + '/cloud/main.js',
  appId: 'hTNcUCXxaxgNLUR6vhLoUliLnadu3shkNUUCsnTX',
  masterKey: 'x1S3MP94OpM2eglWnKLTbXMipkCM5pBf5Eha2Ckn', //Add your master key here. Keep it secret!
  serverURL: 'http://localhost:1337/parse',  // Don't forget to change to https if needed
  liveQuery: {
    classNames: ["Posts", "Comments"] // List of classes to support for query subscriptions
  }
});
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var app = express();
var bodyParser  = require('body-parser');
var cookieParser = require('cookie-parser');

app.set('views', 'cloud/views');
app.set('view engine', 'ejs');

app.use(parseExpressHttpsRedirect());
//app.use(parseExpressCookieSession());

//app.use(express.bodyParser());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

app.use(cookieParser('unOlEZ7WZilyeXBltWh0'));


app.use(cookieSession({
  name: 'NOT_MATURE',
  secret: 'NOT_TOO_GOOD',
  maxAge: 15724800000
}));

app.use(cookieParser('NOT_TOO_GOOD'));

//app.use(parseExpressCookieSession({ cookie: { maxAge: 3600000 }, fetchUser: true }));
//app.use(parseExpressCookieSession({ secret: '41GgBR6aAdxDoORkVOfM' }));

app.get('/', function(req, res) {
    res.render('index');
});

Parse.initialize('hTNcUCXxaxgNLUR6vhLoUliLnadu3shkNUUCsnTX', 'I7HJPTMofOAiG66s0EXKAShUOPyK0mN7z9qyaggY');
//app.use(parseExpressCookieSession({ cookie: { maxAge: 3600000 } }));

app.get('/login', function(req, res) {
    res.render('login', {error: null});
});

app.post('/login', function(req, res) {
    Parse.User.logIn(req.body.username, req.body.password).then(function(user) {
        if (req.body.password === user.get('tempPassword')) {
            req.session.temporaryPassword = true;
            res.redirect('/change-password');
        } else {
            res.redirect('/dashboard');
        }
    }, function(error) {
//        res.render('login', {error: 'Louis found Invalid email or password.'});
//        res.render('login', {error: req.body.username});
        res.render('login', {error: req.body.password});
    });
});

app.get('/logout', function(req, res) {
    Parse.User.logOut();
    res.redirect('/login');
});

app.get('/dashboard', function(req, res) {
    if (Parse.User.current()) {
        var query = new Parse.Query(Parse.Role);
        var changedPassword = req.session.changedPassword;
        req.session.changedPassword = false;
        query.first().then(function() {
            res.render('dashboard', { title: 'Dashboard', description: 'Dashboard', changedPassword: changedPassword });
        }, function() {

           res.render('client_dashboard', { title: 'SharpIC Reports', description: 'SharpIC Reports', changedPassword: changedPassword });
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/change-password', function(req, res) {
    if (Parse.User.current()) {
        res.render('change_password', {error: null, showPassword: !req.session.temporaryPassword});
    } else {
        res.redirect('/login');
    }
});

app.post('/change-password', function(req, res) {
    var user = Parse.User.current();
    if (user) {
        if (req.body.password === req.body.passwordConfirm) {
            Parse.User.logIn(user.getUsername(), req.body.currentPassword || user.get('tempPassword')).then(function (user) {
                user.setPassword(req.body.password);
                user.set('tempPassword', '');
                return user.save();
            }).then(function () {
                req.session.temporaryPassword = false;
                req.session.changedPassword = true;
                res.redirect('/dashboard');
            }, function (error) {
                res.render('change_password', {error: 'Invalid password.', showPassword: !req.session.temporaryPassword});
            });
        } else {
            res.render('change_password', {error: 'Your password does not match the password again field.', showPassword: !req.session.temporaryPassword});
        }
    } else {
        res.redirect('/login');
    }
});

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

//app.listen();

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
//  res.status(200).send('Make sure to star the parse-server repo on GitHub!');
	res.status(200).send(mountPath);
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get('/test', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test.html'));
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('sharpic app running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);

