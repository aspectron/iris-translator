var express = require('express');
var connect = require('connect');
var http = require('http');
var https = require('https');
var transifex = require('./transifex');
var _ = require('underscore');
var zutils = require('zetta-utils');

function Editor (translator, options, callback) {
    var self = this;
    self.port = 3030;
    self.users = {
        translator: '73f0abfcdb3b40579fbc99f9e34ca9d0'
    };
    self.baseUrl = 'tr';
    self.editorViewPath = __dirname + "/../views/";
    self.editorStaticFilesPath = __dirname + '/../http/';
    self.entriesOnPage = 10;

    self.transifex = {
        available: false,
        user: null,
        password: null,
        projectSlug: null,
        resourceSlug: 'Translator'
    };

    self.switchLanguage = function (locale) {
        translator.languages[locale].enabled = !translator.languages[locale].enabled;
    };

    function initConfig (options, callback) {
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

        var baseUrl = options.baseUrl || self.baseUrl;

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

        callback();
    }

    function initExpress (callback) {
        self.app = express();

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

        self.app.use(translator.useSession);
        self.app.set('view engine', 'ejs');
        self.app.set('view options', {layout: false});

        callback();
    }

    function initHttpServer (callback) {
        self.app.get('/', function (req, res) {
            res.redirect(self.baseUrl);
        });

        self.app.get(self.baseUrl, function (req, res) {
            res.render(self.editorViewPath + 'index.ejs', {_T: req._T, languages:translator.languages, language:req.session.locale});
        });

        self.app.get(self.baseUrl + '/locale/:locale', translator.toggleLanguage);

        self.app.get(self.baseUrl + '/enable/:locale', function (req, res) {
            var locale = req.params.locale;

            self.switchLanguage(locale);

            translator.saveLanguagesToStorage(function (err){
                if (err) {
                    // rollback
                    self.switchLanguage(locale);
                    return res.send(500);
                }

                res.send(201, {enabled: translator.languages[locale].enabled});
            });
        });

        self.app.get(self.baseUrl + '/languages', function (req, res) {
            _.each(translator.languages, (function (value, key) {
                if (key == translator.i18n.sourceLanguage) {
                    translator.languages[key].sourceLanguage = true ;
                }
            }));

            res.send(translator.languages);
        });

        self.app.get(self.baseUrl + '/rescan', function (req, res) {
            translator.i18n.importFromFolder(function () {
                res.redirect(self.baseUrl + '/');
            });
        });

        function getEntries(filter, query, skip, limit) {
            var entries = {};
            skip = parseInt(skip) || 0;
            limit = parseInt(limit) || self.entriesOnPage;

            var filteredEntries = {};

            if (!filter || !filter.length) {
                filteredEntries = translator.i18n.entries;
            } else {
                _.each(translator.i18n.entries, function (entry, index) {

                    for (var i = 0, length = filter.length; i < length; i++) {
                        if (entry.locale[filter[i]]) {
                            filteredEntries[index] = entry;
                            break;
                        }
                    }
                });
            }

            if (!query) {
                entries = filteredEntries;
            } else {
                _.each(filteredEntries, function (entry, index) {
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

        self.app.get(self.baseUrl + '/entry', function (req, res) {
            res.send(getEntries(req.param('filter'), req.param('q'), req.param('skip'), req.param('limit')));
        });

        self.app.put(self.baseUrl + '/entry', function (req, res) {
            if (!req.body) return res.send(400, {error: 'no entry'});

            var entry = req.body;

            entry.multiline = entry.multiline == 'true' ? true : false;

            translator.i18n.updateEntry(entry, function (err) {
                if (err) return res.send(500);

                res.send(204);
            });
        });

        self.app.del(self.baseUrl + '/entry/:hash', function (req, res) {
            var hash = req.params.hash;

            translator.i18n.removeEntry(hash, function (err) {
                if (err) return res.send(500);

                res.send(204);
            });
        });

        self.app.get(self.baseUrl + '/export', function (req, res) {
            if (!self.transifex.available) return res.send(405);

            var projectSlug = self.transifex.projectSlug;
            var resourceSlug = self.transifex.resourceSlug;

            transifex.getProject(projectSlug, function (err, project) {
                if (err) {
                    console.error(err);
                    return res.send(500);
                }

                if (!project) {
                    console.error('Transifex Export: Project not found', projectSlug);
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

                    _.each(translator.i18n.entries, function (entry) {
                        //if (!entry.orphan) {
                        for (var locale in entry.locale) {
                            if (locale == entry.original) {
                                if (entry.transifexSourceKey) {
                                    source[entry.transifexSourceKey] = entry.locale[locale];
                                } else {
                                    source[entry.hash] = entry.locale[locale];
                                }
                            } else {
                                if (!translationsForExport[locale]) {
                                    translationsForExport[locale] = {};
                                }

                                if (entry.transifexSourceKey) {
                                    translationsForExport[locale][entry.transifexSourceKey] = entry.locale[locale];
                                } else {
                                    translationsForExport[locale][entry.hash] = entry.locale[locale];
                                }
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

                            setResourceTranslationsToTransifex();

                            res.send(200, {});
                        });
                    } else {
                        transifex.replaceResourceContent(projectSlug, resourceSlug, source, function (err, result) {
                            if (err) {
                                console.error(err);
                                return res.send(500);
                            }

                            console.log('Transifex Export: Resource content is changed', result);

                            setResourceTranslationsToTransifex();

                            res.send(200, {});
                        });
                    }

                    function setResourceTranslationsToTransifex() {
                        _.each(translationsForExport, function (translations, locale) {
                            console.log(locale, translations);
                            transifex.setResourceTranslationsByLangCode(projectSlug, resourceSlug, locale, translations, function (err) {
                                if (!err) {
                                    console.log('Transifex Export: Translations for "', locale.toUpperCase(), '" are created:', translations);
                                }
                            });
                        });
                    }
                });
            });

        });

        self.app.get(self.baseUrl + '/import', function (req, res) {
            if (!self.transifex.available) return res.send(405);

            var projectSlug = self.transifex.projectSlug;
            var resourceSlug = self.transifex.resourceSlug;

            transifex.getProject(projectSlug, function (err, project) {
                if (err) {
                    console.error(err);
                    return res.send(500);
                }

                if (!project) {
                    console.error('Transifex Import: Project not found', projectSlug);
                    return res.send(500);
                }

                console.log('Transifex Import: project', project);

                transifex.getResourceContent(projectSlug, resourceSlug, function (err, source) {
                    if (err) {
                        console.error(err);
                        return res.send(500);
                    }

                    if (!source) {
                        console.error('Resource not found');
                        return res.send(500);
                    }

                    var languageCodes = Object.keys(translator.languages);
                    var translationsForImport = {};

                    var sourceLanguage = translator.i18n.sourceLanguage;

                    for (var key in source) {
                        translationsForImport[key] = {};
                        translationsForImport[key][sourceLanguage] = source[key];
                    }

                    getTranslations();

                    function getTranslations() {
                        var languageCode = languageCodes.pop();

                        if (!languageCode) return setDataToStore();
                        if (languageCode == translator.i18n.sourceLanguage) return getTranslations();

                        transifex.getResourceTranslationsByLangCode(projectSlug, resourceSlug, languageCode, function (err, translations) {
                            if (err) return setDataToStore(err);

                            for (var key in translations) {
                                // if Transifex not has translation for message then it return original on source language
                                if (translationsForImport[key][sourceLanguage] != translations[key]) {
                                    translationsForImport[key][languageCode] = translations[key];
                                }
                            }

                            getTranslations();
                        });

                    }

                    function setDataToStore(err) {
                        if (err) {
                            console.error(err);
                            return res.send(500);
                        }

                        var entries = translator.i18n.entries;

                        for (var key in translationsForImport) {
                            var existInStore = false;

                            if (entries[key]) {
                                for (var languageCode in translationsForImport[key]) {
                                    entries[key].locale[languageCode] = translationsForImport[key][languageCode];
                                }
                            } else {
                                for (var hash in entries) {
                                    if (entries[hash].transifexSourceKey && entries[hash].transifexSourceKey == key) {
                                        existInStore = true;

                                        for (var languageCode in translationsForImport[key]) {
                                            entries[hash].locale[languageCode] = translationsForImport[key][languageCode];
                                        }

                                        break;
                                    }
                                }

                                if (!existInStore) {
                                    try {
                                        translator.i18n.createTransifexEntry(translationsForImport[key], key);
                                    }
                                    catch (e) {
                                        console.log('Transifex Import: entry with', key, ' not added', translationsForImport[key]);
                                    }
                                }
                            }
                        }

                        console.log('Transifex Import: entries for import', translationsForImport);

                        translator.i18n.storeEntries(function () {
                            res.send(200, {});
                        });
                    }
                });
            });
        });

        http.createServer(self.app).listen(self.port, function (err) {
            if (err) {
                console.error("Unable to start HTTP server on port" + self.port);
                return callback(err);
            }

            console.log('TRANSLATOR HTTP server listening on port ' + self.port);

            callback();
        });
    }

    function main () {
        var steps = new zutils.Steps();
        steps.push(function (callback) {
            initConfig(options,callback);
        });
        steps.push(initExpress);
        steps.push(initHttpServer);
        steps.run(function (err) {
            if (err) throw err;

            translator.buildInEditorIsRunning = true;

            callback();
        });
    }

    main();
}

module.exports = Editor