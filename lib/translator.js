var _ = require('underscore');
var i18n = require('./i18n');
var Storage = require('./storage');
var chokidar = require('chokidar');
var path = require('path');
var Editor = require('./editor');
var SEO = require('./seo');


function Translator(options, callback) {
    var self = this;

    callback = typeof callback === "function" ? callback : function () {};

    self.defaultLanguage = 'en';
    self.languages = {"en": {name: "English", enabled: true}};
    self.languagesFileName = 'languages';
    self._languagesFilePath = options.storagePath;
    self._storagePath = options.storagePath;

    self.buildInEditorIsRunning = false;

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

    function init() {
        if (options.defaultLanguage) {
            self.defaultLanguage = options.defaultLanguage;
        }

        if (_.isObject(options.languages)) {
            self.languages = options.languages;
        }

        self.i18n = new i18n(options, function (err) {
            if (err) return callback(err);

            var storage = new Storage({
                storagePath: options.storagePath
            });
            storage.setFilename(self.languagesFileName);

            //self._languagesFilePath = storage.getFilePath();
            //self._storagePath = storage.getDirectory();

            storage.fileExists(function (exists) {
                if (exists) {
                    storage.getData(function (languages) {
                        _.extend(self.languages, languages);
                        callback(null);
                    });
                } else {
                    callback(null);

                    storage.createFile(function (err) {
                        if (err) console.error('Could not create file:', storage.getFilePath());
                    });
                }
            });
        });
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

            var storage = new Storage({filename: self.languagesFileName, storagePath: self._storagePath});
            storage.getData(function (languages) {
                _.extend(self.languages, languages);
            });
        });
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

    init();
}

//GLOBAL.TRANSLATOR = new Translator;
module.exports = Translator;
