#!/usr/bin/env node

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
            enabled: false
        },
        de: {
            name: "Deutsch"
        },
        it: {
            name: "Italiano"
        }
    },
    storagePath: __dirname + '/../example/messages',
    rootFolderPath: __dirname + '/../example/',
    folders: ['views'],
    enableWatcher: true,
    mongoStorage: {
        url: "mongodb://localhost/translation"
    }
}, function () {
    translator.runEditor({
        port: 4000,
        users: {
            'admin': 'qwerty'
        },
        baseUrl: 'translator',
        transifex: {
            user: 'translator.transifex@mail.com',
            password: 'qp7g2l9b58',
            projectSlug: 'jazz-1',
            resourceSlug: 'first-file'
        }
    }, function (err) {
        if (err) {
            console.error('Translator: Editor' ,err)
        }
    });
});