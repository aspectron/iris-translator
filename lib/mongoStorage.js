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
    self.STORAGE_TYPE_LANGUAGE = 'language';
    self.STORAGE_TYPE_TRANSLATION = 'translation';


    self._watchEnabled = false;
    self._watchCollection = null;
    self._watchCollectionName = options.messageCollectionName || "zetta-messages";
    self._watchCollectionMaxSize = 2;

    if (!options.url) return callback(new Error('Mongo database url is not passed'));

    self.url = options.url;

    self.on('change', function (storage) {

    });

    self.iniDb = function (callback) {
        mongo.Db.connect(self.url, function (err, database) {
            if (err) return callback(err);

            console.log("DB '" + self.url + "' connected");

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

    self.initWatchCollection = function (callback) {
        callback();
    };

    self.run = function () {
        var steps = new zutils.Steps();
        steps.push(self.iniDb);
        steps.push(self.initCollection);

        if (options.enableWatcher) {
           steps.push(initWatchCollection);
        }

        steps.run(function (err) {
            if (err) throw err;

            callback();
        });
    };

    setTimeout(self.run, 0);
}

util.inherits(MongoStorage, EventEmitter);

//    function initWatchCollection (callback) {
//        self.database.createCollection(self._watchCollectionName, {capped: true, max: self._watchCollectionMaxSize, size: 4096}, function (err, collection) {
//            if (err) {
//                console.warn(err);
//                finish();
//            } else {
//                self._watchEnabled = true;
//                self._watchCollection = collection;
//
////                        runWatcher(finish);
//
//                // we must create first document after creating of collection
//                // otherwise we will get a heavy load (triggers a lot of handlers)
//                collection.insert({
//                    initiator: '111111-da5e-11e3-87b1-07fd5f72b159',
//                    created: 1399999999999
//                }, function () {
//                    //runWatcher(finish);
//                    finish();
//                });
//            }
//
//            function finish() {
//                callback(null);
//            }
//        });
//    }
//
//    self.runWatcher = function (callback) {
//        initWatchCollection(function () {
//            var firstTime = true;
//
//            var stream = null;
//
//            createStream();
//
//            function createStream() {
//                stream = self._watchCollection.find({}, {tailable: true, awaitdata: true, numberOfRetries: -1}).sort({ $natural: -1 }).stream();
//
//                stream.uuid = uuid.v1();
//
//                // TODO VRuden we have many handlers when connection to collection appears after disconnect
//                stream.on('data', function (msg) {
//                    console.log('Wow');
//                    console.log(stream.uuid);
//                    console.log(msg.created);
//                    if (msg.initiator !== self.uuid && typeof self.onDataChanged === "function") {
//                        self.onDataChanged(msg);
//                    }
//                });
//
//                stream.on('close', function () {
//                    setInterval(function () {
//                        createStream();
//                    }, 0);
//                });
//
//                // if we wont set handler on error event then we will get critical error
//                stream.on('error', function (err) {
//                    console.error(err);
//                    this.removeAllListeners('data');
//                    this.removeAllListeners('error');
//                    this.removeAllListeners('close');
//                });
//
//                if (firstTime) {
//                    firstTime = false;
//                    callback();
//                }
//            }
//        });
//    };
//
//    self.addIteration = function (type) {
//        if (self._watchEnabled) {
//            console.log(type);
//            self._watchCollection.insert({initiator: self.uuid, type: type, created: Date.now()}, function () {
//
//            });
//        }
//    };

module.exports = MongoStorage;