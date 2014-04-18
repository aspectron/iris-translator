var express = require('express');
var http = require('http');
var path = require('path');
var connect = require('connect');
var translator = require('../lib/translator');

var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(connect.json());
app.use(connect.urlencoded());
app.use(connect.cookieParser('11e2-ab1f-0800200c9a66'));
app.use(connect.session({
    secret: 'a879d480-bf58-1b1f-0800200c9a66',
    store: connect.session.MemoryStore({
        reapInterval: 60000 * 60
    })}));
app.use(translator.useSession);

//app.use(app.router);

// development only
if ('development' == app.get('env')) {
    app.use(connect.errorHandler());
}

app.get('/', function (req, res) {
    res.render('index', {_T: req._T, title: 'translator', varFromJs: req._T("A Variable Value"), languages: translator.getEnabledLanguages(), language: req.params.locale});
});

app.get('/configuration', function (req, res) {
    res.render('page1', {_T: req._T, title: 'translator | Configuration options'});
});

app.get('/page2', function (req, res) {
    res.render('page2', {_T: req._T, title: 'translator | Page #2'});
});

app.get('/api/languages', translator.actionGetEnabledLanguages);
app.get('/api/setlang/:locale', translator.toggleLanguage)
//app.get('/locale/:locale', translator.toggleLanguage);

translator.init({
    defaultLanguage: 'de',
    languages: {
        en: {
            name: "English",
            enabled: true
        },
        ru: {
            name: "Русский",
            enabled: false
        },
        de: {
            name: "Deutsch"
        },
        it: {
            name: "Italiano"
        }
    },
    storagePath: __dirname + '/messages',
    rootFolderPath: __dirname,
    folders: ['views']
}, function () {
    translator.separateEditor();

    http.createServer(app).listen(app.get('port'), '127.0.0.1', function () {
        console.log('Express server listening on port ' + app.get('port'));
    });
});




