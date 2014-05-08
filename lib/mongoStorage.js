var mongo = require('mongodb');
var uuid = require('node-uuid');
var _ = require('underscore');

function MongoStorage() {
    var self = this;

    self.collectionDefaultName = "translations";
    self._watchEnabled = false;
    self._watchCollection = null;
    self._watchCollectionName = "translations_messages";
    self._watchCollectionSize = 1;

    self.collection = null;

    self.onDataChanged = function (msg) {
        console.log(msg);
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

                database.createCollection(self._watchCollectionName, { capped: true, size: self._watchCollectionSize }, function (err, collection) {
                    if (err) {
                        console.warn(err);
                        finish();
                    } else {
                        self._watchEnabled = true;
                        self._watchCollection = collection;

                        runWatcher(finish);
                    }

                    function finish() {
                        callback(null);
                    }
                });
            });
        });
    }

    function runWatcher(callback) {
        var sentCallback = false;

        self._watchCollection.count(function(err, count) {
            if (err) ;

            createStream(count);
        });

        function createStream(skip) {
            var stream = self._watchCollection.find({}, {tailable: true, awaitdata: true, numberOfRetries: -1}).skip(skip-1).sort({ $natural: -1 }).stream();

            stream.on('data', function (msg) {
                if (msg.initiator !== self.uuid && typeof self.onDataChanged === "function") {
                    self.onDataChanged(msg);
                }
            });

            stream.on('close', function () {
                setInterval(function () {
                    createStream();
                }, 0);
            });

            if (!sentCallback) {
                callback();
                sentCallback = true;
            }
        }
    }

    self.addIteration = function () {
        if (self._watchEnabled) {
            self._watchCollection.insert({initiator: self.uuid}, function () {

            });
        }
    };

    self.getData = function (callback) {
        self.collection.find().toArray(function (err, docs) {
            if (err) return callback(err);

            _.each(docs, function (doc) {
                delete doc._id;
            });

            callback(null, docs);
        });
    };

    self.setData = function (data, callback) {
        self.getData(function (err, docs) {
            if (err) return callback(err);

            docs = self.wrapToObject(docs);

            var dataForCreating = [];
            var dataForUpdating = [];

            _.each(data, function (entry) {
                if (!docs[entry.hash]) {
                    dataForCreating.push(entry);
                } else if (entry.updated > docs[entry.hash].updated) {
                    dataForUpdating.push(entry);
                }
            });

            self.collection.insert(dataForCreating, function (err, result) {
                if (err) ;

                if (result) {
                    console.log('Added ', result.length , 'entries to mongo');
                }

                _.each(dataForUpdating, function (data) {
                    self.collection.update({hash: data.hash}, data, function (err, result) {

                    });
                });

                callback(null);

                self.addIteration();
            });
        });
    };

    self.removeData = function (hash, callback) {
        self.collection.remove({hash: hash}, callback);
    };

    self.wrapToObject = function (docs) {
        var object = {};

        _.each(docs, function (doc) {
            object[doc.hash] = doc;
        });

        return object;
    }
}

module.exports = MongoStorage;