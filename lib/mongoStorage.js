var mongo = require('mongodb');
var uuid = require('node-uuid');
var _ = require('underscore');

function MongoStorage() {
    var self = this;

    self.collectionDefaultName = "translations";
    self._watchEnabled = false;
    self._watchCollection = null;
    self._watchCollectionName = "translations_messages";
    self._watchCollectionMaxSize = 2;

    self.collection = null;

    self.onDataChanged = function (msg) {
        console.log('Received new data from MongoDB');
    };

    /*
     options = {
     url:
     collectionName:
     onDataChanged: function (msg) {}
     }
     */
     self.init = function (options, callback) {
        self.uuid = uuid.v1();

         if (options.onDataChanged && typeof options.onDataChanged === "function") {
             self.onDataChanged = options.onDataChanged;
         }

        if (!options.url) return callback('Mongo database url is not passed');

        var collectionName = options.collectionName || self.collectionDefaultName;

        mongo.Db.connect(options.url, function (err, database) {
            if (err) return callback(err);

            console.log("DB '" + options.url + "' connected");

            database.collection(collectionName, function (err, collection) {
                if (err) return callback(err);

                collection.ensureIndex({hash: 1}, {unique: true}, function () {
                    if (err) console.error('Index was not created', err);
                });

                self.collection = collection;

                database.createCollection(self._watchCollectionName, { capped: true, max: self._watchCollectionMaxSize, size: 4096 }, function (err, collection) {
                    if (err) {
                        console.warn(err);
                        finish();
                    } else {
                        self._watchEnabled = true;
                        self._watchCollection = collection;

//                        runWatcher(finish);

                        // we must create first document after creating of collection
                        // otherwise we will get a heavy load (triggers a lot of handlers)
                        collection.insert({
                            initiator : '111111-da5e-11e3-87b1-07fd5f72b159',
                            created : 1399999999999
                        }, function () {
                            runWatcher(finish);
                        });
                    }

                    function finish() {
                        callback(null);
                    }
                });
            });
        });
    };

    function runWatcher(callback) {
        var firstTime = true;

        var stream = null;

        createStream();

        function createStream() {
            stream = self._watchCollection.find({}, {tailable: true, awaitdata: true, numberOfRetries: -1}).sort({ $natural: -1 }).stream();

            stream.uuid = uuid.v1();

            // TODO VRuden we have many handlers when connection to collection appears
            stream.on('data', function (msg) {
                console.log('Wow');
                console.log(stream.uuid);
                console.log(msg.created);
                if (msg.initiator !== self.uuid && typeof self.onDataChanged === "function") {
                    self.onDataChanged(msg);
                }
            });

            stream.on('close', function () {
                setInterval(function () {
                    createStream();
                }, 0);
            });

            // if we wont set handler on error event then we will get critical error
            stream.on('error', function (err) {
                console.error(err);
                this.removeAllListeners('data');
                this.removeAllListeners('error');
                this.removeAllListeners('close');
            });

            if (firstTime) {
                firstTime = false;
                callback();
            }
        }
    }

    self.addIteration = function () {
        if (self._watchEnabled) {
            self._watchCollection.insert({initiator: self.uuid, created: Date.now()}, function () {

            });
        }
    };

    self.getData = function (callback) {
        if (!self.collection) return callback('Collection not found');

        self.collection.find().toArray(function (err, docs) {
            if (err) return callback(err);

            _.each(docs, function (doc) {
                delete doc._id;
            });

            callback(null, docs);
        });
    };

    self.setData = function (data, callback) {
        if (!self.collection) return callback('Collection not found');

        self.getData(function (err, docs) {
            if (err) return callback(err);

            docs = self.wrapDocsToObject(docs);

            var dataForCreating = [];
            var dataForUpdating = [];

            _.each(data, function (entry) {
                if (!docs[entry.hash]) {
                    dataForCreating.push(entry);
                } else if (entry.updated > docs[entry.hash].updated) {
                    dataForUpdating.push(entry);
                }
            });

            self.collection.insert(dataForCreating, function (err) {
                if (err) console.log(err);

                _.each(dataForUpdating, function (data) {
                    self.collection.update({hash: data.hash}, data, function (err, result) {

                    });
                });

                callback(null);

                // we wait until all async queries be executed
                setTimeout(function () {
                    self.addIteration();
                }, 5000);
            });
        });
    };

    self.removeData = function (hash, callback) {
        self.collection.remove({hash: hash}, callback);
    };

    self.wrapDocsToObject = function (docs) {
        var object = {};

        _.each(docs, function (doc) {
            object[doc.hash] = doc;
        });

        return object;
    }
}

module.exports = MongoStorage;