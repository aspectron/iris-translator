var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var http = require('http');
var path = require('path');
var Translator = require('../lib/translator');

var translator = new Translator({
    defaultLanguage: 'de',
    languages: {
        en: {
            name: "English",
            enabled: true
        },
        ru: {
            name: "Русский",
            enabled: true
        },
        de: {
            name: "Deutsch",
            enabled: true
        },
        it: {
            name: "Italiano",
            enabled: true
        }
    },
    storagePath: __dirname + '/messages',
    rootFolderPath: __dirname,
    folders: ['views'],
    enableWatcher: true,
    mongoStorage: {
        url: "mongodb://localhost/translation"
    }
}, function () {
    http.createServer(app).listen(app.get('port'), '127.0.0.1', function () {
        console.log('Express server listening on port ' + app.get('port'));
    });
});

var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser());
app.use(cookieParser());
app.use(session({
    secret: 'a879d480-bf58-1b1f-0800200c9a66',
    proxy: true // if you do SSL outside of node.
}));
app.use(translator.useSession);


app.get('/', function (req, res) {
    res.render('index', {_T: req._T, title: 'translator', varFromJs: req._T("A Variable Value"), languages: translator.getEnabledLanguages(), language: req.params.locale});
});

app.get('/configuration', function (req, res) {
    res.render('page1', {_T: req._T, title: 'translator | Configuration options'});
});

app.get('/page2', function (req, res) {
    res.render('page2', {_T: req._T, title: 'translator | Page #2'});
});

app.get('/api/languages', function (req, res) {
    res.send(200, translator.getEnabledLanguages());
});
app.get('/api/setlang/:locale', translator.toggleLanguage)