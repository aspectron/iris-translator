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
    folders: ['views']
}, function () {
    translator.runEditor({
        port: 4000,
        users: {
            'admin': 'qwerty'
        },
        baseUrl: 'translator'
    }, function () {

    });
});