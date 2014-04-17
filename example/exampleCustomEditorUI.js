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

translator.runEditor({
    port: 3030,
    users: {
        'admin': 'qwerty'
    },
    baseUrl: 'translator',
    entriesOnPage: 7,
    editorViewPath: __dirname + '/customEditor/',
    editorStaticFilesPath: __dirname + '/customEditor/staticFiles/',
    storagePath: __dirname + '/messages/',
    rootFolderPath: __dirname,
    folders: ['views'],
    transifex: {
        user: 'translator.transifex.test@gmail.com',
        password: 'qp7g2l9b58',
        projectSlug: 'jazz',
        resourceSlug: 'first-file'
    }
}, function () {

});


// development only
if ('development' == app.get('env')) {
    app.use(connect.errorHandler());
}

app.get('/robots.txt', translator.robots({
    denyUserAgent: ['yandex', 'rambler'],
    allowDirectory: ['main']
}));

app.get('/sitemap.xml', translator.sitemap({
    baseUrl: 'http://example.com',
    displayDefaultLocale: false,
    data: [
        {
            url: '',
            changefreq: 'monthly',
            priority: 1
        },
        {url: 'user'},
        {url: 'profile'},
        {
            url: 'wall',
            changefreq: 'daily',
            priority: 0.7
        }
    ]
}));

/*app.get('/', function (req, res) {
    res.redirect('/' + translator.getDefaultLanguage());
});

app.all('/:locale/*', translator.useUrl);*/

app.get('/', function (req, res) {
    res.render('index', {_T: req._T, title: 'translator', languages: translator.getEnabledLanguages()});
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
    folders: ['views']
}, function () {
    http.createServer(app).listen(app.get('port'), '127.0.0.1', function () {
        console.log('Express server listening on port ' + app.get('port'));
    });
});




