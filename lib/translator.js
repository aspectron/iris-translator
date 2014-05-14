var _ = require('underscore');
var i18n = require('./i18n');
var Storage = require('./storage');
var chokidar = require('chokidar');
var path = require('path');


function Translator() {
    var self = this;

    self.i18n = new i18n;
    self.defaultLanguage = 'en';
    self.languages = {"en": {name: "English", enabled: true}};
    self.languagesFileName = 'languages';
    self._languagesFilePath = '';
    self._storagePath = null;

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

    self.init = function (options, callback) {
        if (options.defaultLanguage) {
            self.defaultLanguage = options.defaultLanguage;
        }

        if (_.isObject(options.languages)) {
            self.languages = options.languages;
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
    };

    self.runEditor = function (options, callback) {
        new require('./editor')(self, options, callback);
    };

    self.robots = function (options) {
        return require('./seo').robots(options);
    };

    self.sitemap = function (options) {
        return require('./seo').sitemap(self, options);
    };
}

GLOBAL.TRANSLATOR = new Translator();
module.exports = GLOBAL.TRANSLATOR;