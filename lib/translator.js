var _ = require('underscore');
var i18n = require('./i18n');
var Storage = require('./storage');
var chokidar = require('chokidar');
var path = require('path');
var Editor = require('./editor');
var SEO = require('./seo');
var zutils = require('zetta-utils');

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

    function initLanguageFileStorage (callback) {
        self.languageFileStorage =  new Storage({filename: self.languagesFileName, storagePath: options.storagePath});
        self.languageFileStorage.setFilename(self.languagesFileName);

        self.languageFileStorage.fileExists(function (exists) {
            if (exists) {
                self.languageFileStorage.getData(function (languages) {
                    _.extend(self.languages, languages);
                    callback(null);
                });
            } else {
                callback(null);

                self.languageFileStorage.createFile(function (err) {
                    if (err) console.error('Could not create file:', self.languageFileStorage.getFilePath());
                });
            }
        });
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

    self.separateEditor = function () {
        if (self.buildInEditorIsRunning) return false;

        if (self.i18n.mongoStorage) return false;

        var translationFilePath = path.normalize(self.i18n.getFilePath());
        var watcher1 = chokidar.watch(translationFilePath, {ignored: /[\/\\]\./, persistent: true});

        watcher1.on('change', function (path) {
            console.log('Translation file', path, 'has been changed by separate editor');

            self.i18n.refreshEntries(function () {
                //console.log(self.i18n.entries);
            });
        });

        var languagesFilePath = path.normalize(self.languageFileStorage.getFilePath());
        var watcher2 = chokidar.watch(languagesFilePath, {ignored: /[\/\\]\./, persistent: true});

        watcher2.on('change', function (path) {
            console.log('Language file', path, 'has been changed by separate editor');

            self.languageFileStorage.getData(function (languages) {
                _.extend(self.languages, languages);
            });
        });
    };

    self.saveLanguagesToStorage = function (callback) {
        self.languageFileStorage.setData(self.languages, callback);

        // TODO VRuden add a saving to mongo storage
    };

    self.runEditor = function (options, callback) {
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
        steps.push(initLanguageFileStorage);

        steps.run(function (err) {
            if (err) throw err;

            callback();
        });
    }

    run();
}

//GLOBAL.TRANSLATOR = new Translator;
module.exports = Translator;
