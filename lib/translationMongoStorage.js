var MongoStorage = require('./mongoStorage');
var _ = require('underscore');
var util = require('util');

function TranslationMongoStorage(options, callback) {
    var self = this;

    MongoStorage.apply(self, arguments);

    self.collectionName = 'zetta-translations' || options.collectionName;

    self.type = self.TYPE_TRANSLATION;
}

util.inherits(TranslationMongoStorage, MongoStorage);

TranslationMongoStorage.prototype.getTranslations = function (callback) {
    var self = this;

    if (!self.collection) return callback(new Error('Translation collection not found'));

    self.collection.find().toArray(function (err, docs) {
        if (err) return callback(err);

        callback(null, docs);
    });
};

TranslationMongoStorage.prototype.setTranslations = function (data, callback) {
    var self = this;

    if (!self.collection) return callback(new Error('Translation collection not found'));

    self.getTranslations(function (err, docs) {
        if (err) return callback(err);

        docs = self.wrapDocsToObject(docs);

        var dataForCreating = [];
        var dataForUpdating = [];

        _.each(data, function (entry) {
            if (!docs[entry.hash]) {
                entry._id = entry.hash;
                dataForCreating.push(entry);

            } else if (entry.updated > docs[entry.hash].updated) {
                //console.log(entry.updated, docs[entry.hash].updated, entry.updated > docs[entry.hash].updated, docs[entry.hash]._id, 'sss')
                dataForUpdating.push(entry);
            }
        });


        if (dataForCreating.length) {
            self.collection.insert(dataForCreating, function (err) {
                if (err && err.code !== 11000) console.error(self.collectionName.toUpperCase(), 'mongo storage: records are not created', err);
            });
        }

        if (dataForUpdating.length) {
            _.each(dataForUpdating, function (data) {
                self.collection.update({_id: data.hash}, data, function (err) {
                    if (err) console.error(self.collectionName.toUpperCase(), 'mongo storage: records are not updated', err);
                });
            });
        }

        // we wait until all async queries be executed
        setTimeout(function () {
            self.emit('change', self);
        }, 1000);

        callback(null);
    });
};

TranslationMongoStorage.prototype.removeTranslation = function (id, callback) {
    var self = this;

    if (!self.collection) return callback(new Error('Translation collection not found'));

    self.collection.remove({_id: id}, callback);
};

TranslationMongoStorage.prototype.wrapDocsToObject = function (docs) {
    var object = {};

    _.each(docs, function (doc) {
        object[doc._id] = doc;
    });

    return object;
}


module.exports = TranslationMongoStorage;