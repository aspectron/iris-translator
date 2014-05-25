var _ = require('underscore');
var i18n = require('./i18n');
var Storage = require('./storage');
var chokidar = require('chokidar');
var path = require('path');
var Editor = require('./editor');
var SEO = require('./seo');
var zutils = require('zetta-utils');
var LanguageMongoStorage = require('./languageMongoStorage');

function Translator(options, callback) {
    var self = this;

    callback = typeof callback === "function" ? callback : function () {};

    self.defaultLanguage = options.defaultLanguage || 'en';
    self.languages = {"en": {name: "English", enabled: true}};
    self.languagesFileName = 'languages';

    self.buildInEditorIsRunning = false;

    if (_.isObject(options.languages)) {
        self.languages = options.languages;
    }

    function initI18N (callback) {
        self.i18n = new i18n(options, callback);
    }

    function initLanguageStorage (callback) {
        self.languageFileStorage =  new Storage({filename: self.languagesFileName, storagePath: options.storagePath});
        self.languageFileStorage.setFilename(self.languagesFileName);

        self.languageFileStorage.fileExists(function (exists) {
            if (exists) {
                self.languageFileStorage.getData(function (languages) {
                    _.extend(self.languages, languages);
                    finish();
                });
            } else {
                finish();

                self.languageFileStorage.createFile(function (err) {
                    if (err) console.error('Could not create file:', self.languageFileStorage.getFilePath());
                });
            }
        });

        function finish () {
            if (options.mongoStorage) {
                self.languageMongoStorage = new LanguageMongoStorage({
                    url: options.mongoStorage.url,
                    languageCollectionName: options.mongoStorage.languageCollectionName,
                    enableWatcher: options.enableWatcher
                }, function () {
                    callback();
                });
            } else {
                callback();
            }
        }
    }

    self.getDefaultLanguage = function () {
        return self.defaultLanguage;
    };

    self.getLanguages = function () {
        return self.languages;
    };

    self.getEnabledLanguages = function () {
        var languages = {};

        _.each(self.languages, function (language, locale) {
            if (language.enabled) {
                languages[locale] = language;
            }
        });

        return languages;
    };

    /**
     * Specifies which language the application is targeted to.
     */
    self.setLanguage = function (locale, req) {
        if (self.languages[locale] && self.languages[locale].enabled) {
            req.session.locale = locale;

            return true;
        }

        return false;
    };

    // middleware
    self.useSession = function (req, res, next) {
        var locale;
        if (req.session) {
            locale = req.session.locale = req.session.locale || self.defaultLanguage;
        } else {
            locale = self.defaultLanguage;
        }

        req._T = function (message, loc) {
            loc = loc ? loc : locale;
            return self.i18n.translate(message, '', '', loc);
        };

        next();
    };

    // middleware
    self.useUrl = function (req, res, next) {
        var locale = req.param('locale'); //req.params.locale;

        if (!_.has(self.languages, locale)) {
            locale = self.defaultLanguage;
        }

        req._T = function (message, loc) {
            loc = loc ? loc : locale;
            return self.i18n.translate(message, '', '', loc);
        };

        next();
    };

    // middleware
    self.toggleLanguage = function (req, res) {
        if (_.has(self.languages, req.params.locale)) {
            req.session.locale = req.params.locale;
        }

        res.redirect('/');
    };

    function initWatcher (callabck) {
        if (self.buildInEditorIsRunning) return false;

        if (options.mongoStorage) {
            // TODO VRuden change the option watch?
            self.i18n.mongoStorage.on('another-precess:change', function (msg) {
                console.log('Translation in mongo has been changed by separate editor');

                self.i18n.refreshEntries(function () {
                    self.i18n.fileStorage.setData(self.i18n.entries, function () {});

                });
            });

            self.languageMongoStorage.on('another-precess:change', function (msg) {
                console.log('Language in mongo has been changed by separate editor');

                self.languageMongoStorage.getLanguages(function (err, languages) {
                    self.languages = languages;
                    self.languageFileStorage.setData(self.languages, function () {});

                });
            });

            callabck();
        } else {
            var translationFilePath = path.normalize(self.i18n.getFilePath());
            var translationWatcher = chokidar.watch(translationFilePath, {ignored: /[\/\\]\./, persistent: true});

            translationWatcher.on('change', function (path) {
                console.log('Translation file', path, 'has been changed by separate editor');

                self.i18n.refreshEntries(function () {
                    //console.log(self.i18n.entries);
                });
            });

            var languagesFilePath = path.normalize(self.languageFileStorage.getFilePath());
            var languageWatcher = chokidar.watch(languagesFilePath, {ignored: /[\/\\]\./, persistent: true});

            languageWatcher.on('change', function (path) {
                console.log('Language file', path, 'has been changed by separate editor');

                self.languageFileStorage.getData(function (languages) {
                    _.extend(self.languages, languages);
                });
            });

            callabck();
        }
    };

    self.saveLanguagesToStorage = function (callback) {
        self.languageFileStorage.setData(self.languages, function () {

            // TODO VRuden add a saving to mongo storage
            if (self.languageMongoStorage) {
                self.languageMongoStorage.setLanguages(self.languages, function (err) {

                    callback();
                });
            } else {
                callback();
            }
        });
    };

    self.runEditor = function (options, callback) {
        if (options.enableWatcher) return callback(new Error("Can't run build in editor because watcher is running"));

        new Editor(self, options, callback);
    };

    self.robots = function (options) {
        return SEO.robots(options);
    };

    self.sitemap = function (options) {
        return SEO.sitemap(self, options);
    };

    function run () {
        var steps = new zutils.Steps();
        steps.push(initI18N);
        steps.push(initLanguageStorage);
        if (options.enableWatcher) {
            steps.push(initWatcher);
        }

        steps.run(function (err) {
            if (err) throw err;

            callback();
        });
    }

    run();
}

//GLOBAL.TRANSLATOR = new Translator;
module.exports = Translator;
