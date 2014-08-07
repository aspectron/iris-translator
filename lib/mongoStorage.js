var util = require('util');
var mongo = require('mongodb');
var uuid = require('node-uuid');
var EventEmitter = require('events').EventEmitter;

var zutils = require('zetta-utils');

function MongoStorage(options, callback) {
    var self = this;

    self.uuid = uuid.v1();

    self.collection = null;
    self.collectionName = 'zetta-collection';
    self.TYPE_LANGUAGE = 'language';
    self.TYPE_TRANSLATION = 'translation';

    self._watchCollection = null;
    self._watchCollectionName = options.messageCollectionName || "zetta-messages";
    self._watchCollectionMaxSize = 2;

    if (!options.url) return callback(new Error('Mongo database url is not passed'));

    self.url = options.url;

    self.on('change', function (storage) {
        if (self._watchCollection) {
            self._watchCollection.insert({initiator: storage.uuid, type: storage.type, created: Date.now()}, function () {

            });
        }
    });

    self.iniDb = function (callback) {
        mongo.Db.connect(self.url, function (err, database) {
            if (err) return callback(err);

            console.log("Translator: DB '" + self.url + "' connected");

            self.database = database;

            callback();
        });
    };

    self.initCollection = function (callback) {
        self.database.createCollection(self.collectionName, function (err, collection) {
            if (err) return callback(err);

            self.collection = collection;

            callback();
        });
    }

    self.initWatcherCollection = function (callback) {
        self.database.createCollection(self._watchCollectionName, {capped: true, max: self._watchCollectionMaxSize, size: 4096}, function (err, collection) {
            if (err) {
                console.error('Translator:', err);
            } else {
                self._watchCollection = collection;
            }

            callback(null);
        });
    };

    self.runWatcher = function (callback) {
        var stream = null;
        if (options.enableWatcher && self._watchCollection) {
            createStream();
        }

        var displayError = false;

        function createStream() {
            stream = self._watchCollection.find({}, {tailable: true, awaitdata: true, numberOfRetries: -1}).sort({ $natural: -1 }).stream();
            stream.uuid = uuid.v1();

            stream.on('data', function (msg) {
                displayError = false;
                if (msg.initiator !== self.uuid && msg.type == self.type) {
                    self.emit('another-precess:change', msg);
                }
            });

            stream.on('close', function () {
                setTimeout(function () {
                    createStream();
                }, 0);
            });

            // if we wont set handler on error event then we will get critical error
            stream.on('error', function (err) {
                if (!displayError) {
                    displayError = true;
                    console.error('Translator: watcher of', self.collectionName, 'collection', err);
                }
            });
        }

        callback();
    };

    self.run = function () {
        var steps = new zutils.Steps();
        steps.push(self.iniDb);
        steps.push(self.initCollection);
        steps.push(self.initWatcherCollection);

        if (options.enableWatcher) {
            steps.push(self.runWatcher);
        }

        steps.run(function (err) {
            if (err) throw err;

            callback();
        });
    };

    setTimeout(self.run, 0);
}

util.inherits(MongoStorage, EventEmitter);

module.exports = MongoStorage;