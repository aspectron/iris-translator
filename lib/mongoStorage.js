var mongo = require('mongodb');
var uuid = require('node-uuid');
var _ = require('underscore');

function MongoStorage() {
    var self = this;

    self.translationCollectionDefaultName = "zetta-translations";
    self.languageCollectionDefaultName = "zetta-languages";
    self._watchEnabled = false;
    self._watchCollection = null;
    self._watchCollectionName = "translations_messages";
    self._watchCollectionMaxSize = 2;

    self.translation = null;
    self.language = null;

    self.onDataChanged = function (msg) {
        console.log('Received new data from MongoDB');
    };

    /*
     options = {
     url:
     translationCollectionName:
     languageCollectionName:
     onDataChanged: function (msg) {}
     }
     */
     self.init = function (options, callback) {
        self.uuid = uuid.v1();

         if (options.onDataChanged && typeof options.onDataChanged === "function") {
             self.onDataChanged = options.onDataChanged;
         }

        if (!options.url) return callback('Mongo database url is not passed');

        var translationCollectionName = options.translationCollectionName || self.translationCollectionDefaultName;
        var languageCollectionName = options.languageCollectionName || self.languageCollectionDefaultName;

        mongo.Db.connect(options.url, function (err, database) {
            if (err) return callback(err);

            console.log("DB '" + options.url + "' connected");

            database.createCollection(translationCollectionName, function (err, collection) {
                if (err) return callback(err);

                self.translation = collection;

                database.createCollection(languageCollectionName, function (err, collection) {
                    if (err) return callback(err);

                    self.language = collection;

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
        });
    };

    function runWatcher(callback) {
        var firstTime = true;

        var stream = null;

        createStream();

        function createStream() {
            stream = self._watchCollection.find({}, {tailable: true, awaitdata: true, numberOfRetries: -1}).sort({ $natural: -1 }).stream();

            stream.uuid = uuid.v1();

            // TODO VRuden we have many handlers when connection to collection appears after disconnect
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
        if (!self.translation) return callback('Translation collection not found');

        self.translation.find().toArray(function (err, docs) {
            if (err) return callback(err);

            _.each(docs, function (doc) {
                doc._id;
            });

            callback(null, docs);
        });
    };

    self.setTranslations = function (data, callback) {
        if (!self.translation) return callback('Translation collection not found');

        self.getData(function (err, docs) {
            if (err) return callback(err);

            docs = self.wrapDocsToObject(docs);

            var dataForCreating = [];
            var dataForUpdating = [];

            _.each(data, function (entry) {
                if (!docs[entry.hash]) {
                    entry._id = entry.hash;
                    dataForCreating.push(entry);

                } else if (entry.updated > docs[entry.hash].updated) {
                    console.log(entry.updated, docs[entry.hash].updated, entry.updated > docs[entry.hash].updated, docs[entry.hash]._id, 'sss')
                    dataForUpdating.push(entry);
                }
            });


            if (dataForCreating.length) {
                self.translation.insert(dataForCreating, function (err) {
                    // TODO VRuden add message where a error was happen
                    if (err) console.log(err);
                });
            }

            if (dataForUpdating.length) {
                _.each(dataForUpdating, function (data) {
                    self.translation.update({_id: data.hash}, data, function (err, result) {

                    });
                });
            }

            callback(null);

            // we wait until all async queries be executed
            setTimeout(function () {
                self.addIteration();
            }, 5000);


        });
    };

    self.removeTranslation = function (id, callback) {
        if (!self.translation) return callback('Translation collection not found');

        self.translation.remove({_id: id}, callback);
    };

    self.wrapDocsToObject = function (docs) {
        var object = {};

        _.each(docs, function (doc) {
            object[doc._id] = doc;
        });

        return object;
    }
}

module.exports = MongoStorage;