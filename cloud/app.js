var express = require('express');
var parseExpressHttpsRedirect = require('parse-express-https-redirect');
var parseExpressCookieSession = require('parse-express-cookie-session');
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

//app.use(parseExpressCookieSession({ cookie: { maxAge: 3600000 }, fetchUser: true }));

//app.use(parseExpressCookieSession({ secret: '41GgBR6aAdxDoORkVOfM' }));

app.get('/', function(req, res) {
    res.render('index');
});

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
        res.render('login', {error: 'Invalid email or password.'});
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

app.listen();