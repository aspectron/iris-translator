var fs = require('fs');
var os = require('os');
var crypto = require('crypto');
var _ = require('underscore');
var express = require('express');
var connect = require('connect');
var http = require('http');
var https = require('https');
var i18n = require('./i18n');
var Storage = require('./storage');
var chokidar = require('chokidar');
var transifex = require('./transifex');
var path = require('path');


var ACTIVE_FLUSH = true;
var defaultLanguage = 'en';
var buildInEditorIsRunning = false;

function Translator() {
    var self = this;

    self.i18n = new i18n();
    self.languages = {"en": {name: "English", enabled: true}}
    self.defaultBaseUrl = 'tr';
    self.port = 32032;
    self.users = {
        translator: '73f0abfcdb3b40579fbc99f9e34ca9d0'
    }
    self.entriesOnPage = 10;

    self.languagesFileName = 'languages';
    self._languagesFilePath = '';
    self._storagePath = null;
    self.editorViewPath = __dirname + "/../views/";
    self.editorStaticFilesPath = __dirname + '/../http/';
    self.transifex = {
        available: false,
        user: null,
        password: null,
        projectSlug: null,
        resourceSlug: 'Translator'
    }

    self.init = function (options, callback) {
        var self = this;

        if (options.defaultLanguage) {
            defaultLanguage = options.defaultLanguage;
        }

        if (_.isObject(options.languages)) {
            this.languages = options.languages;
        }

        self.i18n.init(options, function (err) {
            if (err) return callback(err);

            var storage = Storage();
            storage.setFilename(self.languagesFileName);
            storage.setDirectory(options.storagePath);

            self._languagesFilePath = storage.getFilePath();
            self._storagePath = storage.getDirectory();

            storage.getData(function (languages) {
                _.extend(self.languages, languages);
                callback(null);
            });
        });
    }

    // middleware
    self.useSession = function (req, res, next) {
        var locale;
        if (req.session) {
            locale = req.session.locale = req.session.locale || defaultLanguage;
        } else {
            locale = defaultLanguage;
        }

        req._T = function (message, loc) {
            loc = loc ? loc : locale;
            return self.i18n.translate(message, '', '', loc);
        }

        if (typeof next === 'function') {
            next();
        }
    }

    // middleware
    self.useUrl = function (req, res, next) {
        var locale = req.param('locale'); //req.params.locale;

        if (!_.has(self.languages, locale)) {
            locale = defaultLanguage;
        }

        req._T = function (message, loc) {
            loc = loc ? loc : locale;
            return self.i18n.translate(message, '', '', loc);
        }

        next();
    }

    // middleware
    self.toggleLanguage = function (req, res, next) {
        if (_.has(self.languages, req.params.locale)) {
            req.session.locale = req.params.locale;
        }

        res.redirect('/');
    }

    self.activateLanguage = function (locale, req) {
        if (_.has(self.languages, locale)) {
            if(req.session.locale != locale){
                req.session.locale = locale;
                return {succes:true, msg:""};
            }else{
                return {succes:true, msg:"Already active"};
            }
        }
        return false;
    }

    // middleware
    self.actionGetLanguages = function (req, res) {
        res.send(200, self.languages);
    }

    // middleware
    self.actionGetEnabledLanguages = function (req, res) {
        res.send(200, self.getEnabledLanguages());
    }

    self.getDefaultLanguage = function () {
        return defaultLanguage;
    }

    self.getLanguages = function () {
        return this.languages;
    }

    self.switchLanguage = function (locale) {
        if (this.languages[locale].enabled) {
            this.languages[locale].enabled = false;
        } else {
            this.languages[locale].enabled = true;
        }
    }

    self.getEnabledLanguages = function () {
        var languages = {};

        _.each(this.languages, function (language, locale) {
            if (language.enabled) {
                languages[locale] = language;
            }
        });

        return languages;
    }

    self.separateEditor = function () {
        if (buildInEditorIsRunning) return false;

        var self = this;

        var translationFilePath = path.normalize(self.i18n.getFilePath());
        var languagesFilePath = path.normalize(self._languagesFilePath);
        var watcher1 = chokidar.watch(translationFilePath, {ignored: /[\/\\]\./, persistent: true});

        watcher1.on('change', function (path) {
            console.log('Translation file', path, 'has been changed by separate editor');

            self.i18n.refreshEntries(function () {
                //console.log(self.i18n.entries);
            });
        });

        var watcher2 = chokidar.watch(languagesFilePath, {ignored: /[\/\\]\./, persistent: true});

        watcher2.on('change', function (path) {
            console.log('Language file', path, 'has been changed by separate editor');

            var storage = Storage({filename: self.languagesFileName, directory: self._storagePath});
            storage.getData(function (languages) {
                _.extend(self.languages, languages);
            });
        });
    }

    self.runEditor = function (options, callback) {
        buildInEditorIsRunning = true;

        function setOptions() {

            self.app = express();

            if (options.port) {
                self.port = options.port;
            }
            if(options.editorStaticFilesPath){
                self.editorStaticFilesPath = options.editorStaticFilesPath;
            }
            if(options.editorViewPath){
                self.editorViewPath = options.editorViewPath;
            }

            if (_.isObject(options.users)) {
                self.users = options.users;
            }

            var baseUrl = options.baseUrl || self.defaultBaseUrl;

            if (baseUrl.slice(-1) == '/') {
                baseUrl = baseUrl.slice(0, -1);
            }

            if (baseUrl.charAt(0) !== '/') {
                baseUrl = '/' + baseUrl;
            }

            self.baseUrl = baseUrl;

            if (options.entriesOnPage) {
                self.entriesOnPage = options.entriesOnPage;
            }

            if (options.transifex) {
                self.transifex.available = true;
                self.transifex.user = options.transifex.user;
                self.transifex.password = options.transifex.password;

                self.transifex.projectSlug = options.transifex.projectSlug;

                if (options.transifex.resourceSlug) {
                    self.transifex.resourceSlug = options.transifex.resourceSlug;
                }

                transifex.init({
                    user: self.transifex.user,
                    password: self.transifex.password
                });
            }
        }

        setOptions();


        self.app.locals.title = 'Translation';

        self.app.locals.baseUrl = self.baseUrl;

        self.app.use(connect.basicAuth(function (username, password) {
            return self.users[username] && password == self.users[username];
        }));

        self.app.use(express.static(self.editorStaticFilesPath));

        self.app.use(connect.bodyParser());
        self.app.use(connect.cookieParser('translator-a0f0d060-bf58-11e2-ab1f-0800200c9a66'));
        self.app.use(connect.session({
            secret: 'translator-a879d480-bf58-11e2-ab1f-0800200c9a66',
            cookie: {path: self.baseUrl},
            store: connect.session.MemoryStore({
                reapInterval: 60000 * 60
            })
        }));

        self.app.use(self.useSession);
        self.app.set('view engine', 'ejs');
        self.app.set('view options', {layout: false});

        //self.app.use(self.app.router);

        self.app.get('/', function (req, res, next) {
            res.redirect(self.baseUrl);
        });

        self.app.get(self.baseUrl, function (req, res, next) {
            res.render(self.editorViewPath + 'index.ejs', {_T: req._T, languages:self.languages, language:req.session.locale});
        });

        /*
         self.app.get(self.baseUrl + '/toggle/:locale', function (req, res, next) {
         var locale = req.params.locale;

         if (locale == 'all') {
         req.session._locale = {};
         _.each(self.LANGUAGES, function (lang, locale) {
         req.session._locale[locale] = true
         })
         } else if (locale == 'none') {
         req.session._locale = {};
         _.each(self.LANGUAGES, function (lang, locale) {
         req.session._locale[locale] = false
         })
         } else {
         if (!self.LANGUAGES[locale])
         return res.end('locale ' + locale + ' not supported');

         if (!req.session._locale)
         req.session._locale = {};
         if (!req.session._locale[locale])
         req.session._locale[locale] = true;
         else
         req.session._locale[locale] = false;
         }

         console.log(req.session);

         // console.log(req.session._locale);
         //res.redirect(self.baseUrl+'/');
         res.end('<html><head><meta http-equiv="refresh" content="0;url=/" /></head><body></body></html>');
         });
         */

        // method not used
//        self.app.get(self.baseUrl + '/toggle/:locale', function (req, res, next) {
//            var locale = req.params.locale;
//
//            if (!self.languages[locale]) {
//                return res.send(400, {error: 'Locale ' + locale + ' not supported'});
//            }
//
//            req.session.locale = locale;
//
//            //res.redirect(self.baseUrl+'/');
//            res.end('<html><head><meta http-equiv="refresh" content="0;url=/" /></head><body></body></html>');
//        });

        self.app.get(self.baseUrl + '/locale/:locale', self.toggleLanguage);

        self.app.get(self.baseUrl + '/enable/:locale', function (req, res, next) {
            var locale = req.params.locale;

            self.switchLanguage(locale);

            var storage = Storage({filename: self.languagesFileName, directory: self._storagePath});

            storage.setData(self.languages, function (err) {
                if (err) {
                    // rollback
                    self.switchLanguage(locale);
                    return res.send(500);
                }

                res.send(201, {enabled: self.languages[locale].enabled});
            });
        });

        self.app.get(self.baseUrl + '/languages', function (req, res, next) {
            res.send(self.languages);
        });

        self.app.get(self.baseUrl + '/rescan', function (req, res, next) {
            self.i18n.importFromFolder(function () {
                res.redirect(self.baseUrl + '/');
            });
        });

        function getEntries(query, skip, limit) {
            var entries = {};
            skip = parseInt(skip) || 0;
            limit = parseInt(limit) || self.entriesOnPage;

            if (!query) {
                entries = self.i18n.entries;
            } else {
                _.each(self.i18n.entries, function (entry, index) {
                    for (var locale in entry.locale) {
                        if (entry.locale[locale].toLowerCase().indexOf(query) != -1) {
                            entries[index] = entry;
                            break;
                        }
                    }
                });
            }

            var totalNumber = _.size(entries);

            if (skip || limit) {
                var entriesPart = {};
                var i = 0;
                var count = 0;

                for (hash in entries) {
                    if (skip <= i) {
                        if (limit && limit == count) break;

                        entriesPart[hash] = entries[hash];
                        count++;
                    }

                    i++;
                }

                entries = entriesPart;
            }

            return {
                entries: entries,
                totalNumber: totalNumber,
                entriesOnPage: self.entriesOnPage
            };
        }

        self.app.get(self.baseUrl + '/entry/:q', function (req, res, next) {
            var query = req.params.q;

            res.send(getEntries(query, req.param('skip'), req.param('limit')));
        });

        self.app.get(self.baseUrl + '/entry', function (req, res, next) {
            //res.contentType('application/json');
            //res.end(JSON.stringify(self.entries, null, '\t'));
            res.send(getEntries('', req.param('skip'), req.param('limit')));
        });

        self.app.put(self.baseUrl + '/entry', function (req, res, next) {
            if (!req.body) return res.send(400, {error: 'no entry'});

            var entry = req.body;

            if (!entry.hash || !self.i18n.entries[entry.hash]) return res.send(404);

            var o = self.i18n.entries[entry.hash];

            _.each(entry.locale, function (text, code) {
                if (!self.languages[code]) {
                    return console.error("Error: not supported locale code:", code);
                }

                o.locale[code] = text;
            });

            if (entry.multiline == 'true') {
                o.multiline = true;
            } else {
                o.multiline = false;
            }

            console.log("Updating entry:", o);

            if (ACTIVE_FLUSH) {
                self.i18n.storeEntries(finish);
            } else {
                finish();
            }

            function finish(err) {
                if (err) return res.send(500);

                res.send(204);
            }
        });

        self.app.del(self.baseUrl + '/entry/:hash', function (req, res, next) {
            var hash = req.params.hash;

            if (!self.i18n.entries[hash]) return res.send(404);

            console.log("Deleting entry:", hash);

            delete self.i18n.entries[hash];

            if (ACTIVE_FLUSH) {
                self.i18n.storeEntries(finish);
            } else {
                finish();
            }

            function finish(err) {
                if (err) return res.send(500);

                res.send(204);
            }
        });

        self.app.del(self.baseUrl + '/entry/:hash/:locale', function (req, res, next) {
            var hash = req.params.hash;
            var locale = req.params.locale;

            if (!self.i18n.entries[hash]) return res.send(404);

            if (self.i18n.entries[hash].locale[locale]) {
                console.log("Deleting locale", locale, "in entry:", hash);

                delete self.i18n.entries[hash].locale[locale];

                if (ACTIVE_FLUSH) {
                    self.i18n.storeEntries(finish);
                } else {
                    finish();
                }
            } else {
                finish();
            }

            function finish(err) {
                if (err) return res.send(500);

                res.send(204);
            }
        });

        self.app.get(self.baseUrl + '/export', function (req, res, next) {
            if (!self.transifex.available) return res.send(503);

            var projectSlug = self.transifex.projectSlug;
            var resourceSlug = self.transifex.resourceSlug;

            transifex.getProject(projectSlug, function (err, project) {
                if (err) {
                    console.error(err);
                    return res.send(500);
                }

                if (!project) {
                    console.error('Project not found', projectSlug);
                    return res.send(500);
                }

                console.log('Transifex Export: project', project);

                transifex.getResource(projectSlug, resourceSlug, function (err, resource) {
                    if (err) {
                        console.error(err);
                        return res.send(500);
                    }

                    var translationsForExport = {};
                    var source = {};

                    _.each(self.i18n.entries, function (entry) {
                        //if (!entry.orphan) {
                            for (var locale in entry.locale) {
                                if (locale == entry.original) {
                                    source[entry.hash] = entry.locale[locale];

                                } else {
                                    if (!translationsForExport[locale]) {
                                        translationsForExport[locale] = {};
                                    }

                                    translationsForExport[locale][entry.hash] = entry.locale[locale];
                                }
                            }
                        //}
                    });

                    console.log('Transifex Export: source for translating', source);
                    console.log('Transifex Export: translations for export', translationsForExport);

                    if (!resource) {
                        transifex.createResource(projectSlug, {
                            slug: resourceSlug,
                            name: resourceSlug,
                            content: source
                        }, function (err, result) {
                            if (err) {
                                console.error(err);
                                return res.send(500);
                            }

                            console.log('Transifex Export: Resource is created', result);

                            setResourceTranslationsToTransifex(projectSlug, resourceSlug, translationsForExport);

                            res.send(200, {});
                        });
                    } else {
                        transifex.replaceResourceContent(projectSlug, resourceSlug, source, function (err, result) {
                            if (err) {
                                console.error(err);
                                return res.send(500);
                            }

                            console.log('Transifex Export: Resource content is changed', result);

                            setResourceTranslationsToTransifex(projectSlug, resourceSlug, translationsForExport);

                            res.send(200, {});
                        });
                    }
                });
            });

        });

        function setResourceTranslationsToTransifex(projectSlug, resourceSlug, translationsForExport) {
            _.each(translationsForExport, function (translations, locale) {
                console.log(locale, translations);
                transifex.setResourceTranslationsByLangCode(projectSlug, resourceSlug, locale, translations, function (err) {
                    if (!err) {
                        console.log('Transifex Export: Translations for "', locale.toUpperCase(), '" are created:', translations);
                    }
                });
            });
        }

        console.log("TRANSLATOR HTTP server listening on port: ", self.port);
        http.createServer(self.app).listen(self.port);

        callback();
    }


    /**
     *
     * Options:
     *  allowUserAgent:
     *  or
     *  denyUserAgent:
     *
     *  allowDirectory:
     *  or
     *  denyDirectory:
     *
     * @param options
     * @returns {Function}
     */
    self.robots = function (options) {
        options = options ? options : {};

        var text = '';
        var allowDirectory = '';
        var denyDirectory = '';

        if (options.allowDirectory) {
            // Disallow: /
            // Allow: /translator
            allowDirectory += '\nDisallow: /';

            options.allowDirectory.forEach(function (directory) {
                allowDirectory += '\nAllow: /' + directory;
            });
        } else if (options.denyDirectory) {
            // Disallow: /translator
            options.denyDirectory.forEach(function (directory) {
                denyDirectory += '\nDisallow: /' + directory;
            });
        }

        if (options.allowUserAgent) {
            // User-agent: *
            // Disallow: /
            // User-agent: Mediapartners-Google
            // Allow: /
            text += '\nUser-agent: *';
            text += '\nDisallow: /';

            options.allowUserAgent.forEach(function (userAgent) {
                text += '\n\nUser-agent: ' + userAgent;

                if (allowDirectory) {
                    text += allowDirectory;
                } else if (denyDirectory) {
                    text += '\nAllow: /';
                    text += denyDirectory;
                } else {
                    text += '\nAllow: /';
                }
            });

        } else if (options.denyUserAgent) {
            // User-agent: BadBot
            // Disallow: /
            options.denyUserAgent.forEach(function (userAgent) {
                text += '\n\nUser-agent: ' + userAgent;

                if (allowDirectory) {
                    text += allowDirectory;
                } else if (denyDirectory) {
                    text += denyDirectory;
                } else {
                    text += '\nDisallow: /';
                }
            });
        } else {
            text += '\n\nUser-agent: *';

            if (allowDirectory) {
                text += allowDirectory;
            } else if (denyDirectory) {
                text += denyDirectory;
            } else {
                text += '\nAllow: /';
            }
        }

        var host = null;
        var sitemap = null;

        return function (req, res) {
            if (!host && options.host) {
                host = options.host;
            } else if (!host) {
                //host = req.host;
                host = req.headers.host;
            }

            if (!sitemap && options.sitemap) {
                sitemap = options.sitemap;
            } else if (!sitemap) {
                sitemap = 'http://' + host + '/sitemap.xml';
            }

            message = text;

            message += '\n\nHost: ' + host;
            message += '\nSitemap: ' + sitemap;

            res.end(message);
        }
    },


    /**
     *
     * Options:
     *  {
     *    baseUrl: 'example.com',
     *    displayDefaultLocale: true,
     *    data: [
     *        {
     *            url: '',
     *            changefreq: 'monthly',
     *            priority: 1
     *        },
     *        {url: 'user'},
     *        {url: 'profile'}
     *    ]
     *  }
     *
     * @param options
     * @returns {Function}
     */
    self.sitemap = function (options) {
        var self = this;
        var data = options.data || {};
        var baseUrl = options.baseUrl;
        var displayDefaultLocale = options.displayDefaultLocale;

        return function (req, res, next) {
            res.contentType('text/xml');

            if (!baseUrl) {
                baseUrl = req.protocol + '://' + req.headers.host;
            }

            var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

            _.each(data, function (row) {
                _.each(self.getEnabledLanguages(), function (language, code) {
                    var url = row.url ? '/' + row.url : '';

                    xml += '<url>\n<loc>' + baseUrl + (!displayDefaultLocale && code == defaultLanguage ? url : '/' + code + url) + '</loc>\n';

                    if (row.lastmod) {
                        xml += '<lastmod>' + row.lastmod + '</lastmod>';
                    }
                    if (row.changefreq) {
                        xml += '<changefreq>' + row.changefreq + '</changefreq>';
                    }
                    if (row.priority) {
                        xml += '<priority>' + row.priority + '</priority>';
                    }

                    xml += '</url>\n';
                });
            });

            xml += '</urlset>';

            res.end(xml);
        }
    }
}

GLOBAL.TRANSLATOR = new Translator();
module.exports = GLOBAL.TRANSLATOR;