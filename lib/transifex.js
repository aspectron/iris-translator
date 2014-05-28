var request = require('request');

const BASE_URL = 'https://www.transifex.com/api/2/';
const BASE_PROJECT_URL = BASE_URL + 'projects/';
const PROJECT_URL = BASE_URL + 'project/<project_slug>';
const BASE_LANGUAGE_URL = BASE_URL + 'project/<project_slug>/languages/';
const BASE_RESOURCE_URL = BASE_URL + 'project/<project_slug>/resources/';
const RESOURCE_URL = BASE_URL + 'project/<project_slug>/resource/<resource_slug>/';
const RESOURCE_CONTENT_URL = BASE_URL + 'project/<project_slug>/resource/<resource_slug>/content/';
const TM_URL = BASE_URL + 'project/<project_slug>/tm/exchange';
const RESOURCE_TRANSLATION = BASE_URL + 'project/<project_slug>/resource/<resource_slug>/translation/<lang_code>/';

const FORMAT_JSON = 'KEYVALUEJSON';

function Transifex() {
    var self = this;
    self.user = null;
    self.password = null;

    self.init = function (options) {
        if (options.user && options.password) {
            self.user = options.user;
            self.password = options.password;
            return self;
        }

        throw new Error('User name or password are not being passed');
    };

    self._requestGet = function (url, callback) {
        request.get(url, {
            auth: {
                user: self.user,
                pass: self.password
            },
            json: {}
        }, function (error, response, body) {
            if (error) return callback(error);

            if (response.statusCode == 200) return callback(null, body);
            if (response.statusCode == 404) return callback(null);

            callback(body);
        });
    };

    self._requestPost = function (url, data, callback) {
        request.post(url, {
            auth: {
                user: self.user,
                pass: self.password
            },
            json: data
        }, function (error, response, body) {
            if (error) return callback(error);

            if (response.statusCode == 201) return callback(null, body);

            callback(body);
        });
    };

    self._requestPut = function (url, data, callback) {
        request.put(url, {
            auth: {
                user: self.user,
                pass: self.password
            },
            json: data
        }, function (error, response, body) {
            if (error) return callback(error);

            if (response.statusCode == 200) return callback(null, body);

            callback(body);
        });
    };

    self.getProject = function (projectSlug, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));

        var url = PROJECT_URL.replace('<project_slug>', projectSlug);

        self._requestGet(url, callback);
    };

    /**
     * Creates new project
     *
     * var data = {
     *      "slug": "test-project",
     *      "name": "Test project",
     *      "source_language_code": "en",
     *      "description": "Description",
     *      "private": true
     *   }
     *
     * @param data {Object}
     * @param callback
     */
    self.createProject = function (data, callback) {
        self._requestPost(BASE_PROJECT_URL, data, callback);
    };

    self.getProjectLanguages = function (projectSlug, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));

        var url = BASE_LANGUAGE_URL.replace('<project_slug>', projectSlug);

        self._requestGet(url, callback);
    };

    /**
     *
     *
     * @param projectSlug
     * @param languageCode {String}
     * @param callback
     * @returns {*}
     */
    self.createProjectLanguage = function (projectSlug, languageCode, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));

        var url = BASE_LANGUAGE_URL.replace('<project_slug>', projectSlug);

        var data = {
            language_code: languageCode,
            coordinators: []
        };

        self._requestPost(url, data, callback);
    };

    self.getResource = function (projectSlug, resourceSlug, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));
        if (!resourceSlug.length) return callback(new Error('Resource slug is not being passed'));

        var url = RESOURCE_URL.replace('<project_slug>', projectSlug).replace('<resource_slug>', resourceSlug);

        self._requestGet(url, callback);
    };

    /**
     * data = {
     *  slug: 'resssss',
     *  name: 'Second Resource',
     *  content: {"first":"simple word", "second": "hard world"}
     * }
     *
     * @param projectSlug
     * @param data {Object}
     * @param callback
     * @returns {*}
     */
    self.createResource = function (projectSlug, data, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));

        var url = BASE_RESOURCE_URL.replace('<project_slug>', projectSlug);

        data.i18n_type = FORMAT_JSON;
        data.content = JSON.stringify(data.content);

        self._requestPost(url, data, callback);
    };

    self.getResourceContent = function (projectSlug, resourceSlug, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));
        if (!resourceSlug.length) return callback(new Error('Resource slug is not being passed'));

        var url = RESOURCE_CONTENT_URL.replace('<project_slug>', projectSlug).replace('<resource_slug>', resourceSlug);

        self._requestGet(url, function (err, response) {
            if (err) return callback(err);

            var data = response;

            if (response) {
                try {
                    data = JSON.parse(response.content);
                } catch (e) {
                    return callback(e);
                }
            }

            return callback(null, data);
        });
    };

    /**
     * Replace source language of the resource
     *
     * data = {"Remember me for 30 days": "Remember me for 30 days"}
     *
     * @param projectSlug
     * @param resourceSlug
     * @param data {Object}
     * @param callback
     * @returns {*}
     */
    self.replaceResourceContent = function (projectSlug, resourceSlug, data, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));
        if (!resourceSlug.length) return callback(new Error('Resource slug is not being passed'));

        var url = RESOURCE_CONTENT_URL.replace('<project_slug>', projectSlug).replace('<resource_slug>', resourceSlug);

        data = {
            'content': JSON.stringify(data)
        };

        self._requestPut(url, data, callback);
    };

    /**
     *
     * return {"Remember me for 30 days": "Lembrar de mim por 30 dias"}
     *
     * @param projectSlug
     * @param resourceSlug
     * @param langCode
     * @param callback
     * @returns {*}
     */
    self.getResourceTranslationsByLangCode = function (projectSlug, resourceSlug, langCode, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));
        if (!resourceSlug.length) return callback(new Error('Resource slug is not being passed'));
        if (!langCode.length) return callback(new Error('Language code not is being passed'));

        var url = RESOURCE_TRANSLATION.replace('<project_slug>', projectSlug).replace('<resource_slug>', resourceSlug).replace('<lang_code>', langCode);

        self._requestGet(url, function (err, response) {
            if (err) return callback(err);

            try {
                var data = JSON.parse(response.content);
            } catch (e) {
                return callback(e);
            }

            return callback(null, data);
        });
    };

    /**
     * Create or update the translation for the specified language
     *
     * data = {"Remember me for 30 days": "Lembrar de mim por 30 dias"}
     *
     * @param projectSlug
     * @param resourceSlug
     * @param langCode
     * @param data {Object}
     * @param callback
     * @returns {*}
     */
    self.setResourceTranslationsByLangCode = function (projectSlug, resourceSlug, langCode, data, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));
        if (!resourceSlug.length) return callback(new Error('Resource slug is not being passed'));
        if (!langCode.length) return callback(new Error('Language code is not being passed'));

        var url = RESOURCE_TRANSLATION.replace('<project_slug>', projectSlug).replace('<resource_slug>', resourceSlug).replace('<lang_code>', langCode);

        data = {
            'content': JSON.stringify(data)
        };

        self._requestPut(url, data, callback);
    };

    self.getTM = function (projectSlug, callback) {
        if (!projectSlug.length) return callback(new Error('Project slug is not being passed'));

        var url = TM_URL.replace('<project_slug>', projectSlug);

        self._requestGet(url, callback);
    };
}

module.exports = new Transifex;