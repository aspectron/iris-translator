var MongoStorage = require('./mongoStorage');
var util = require('util');

function LanguageMongoStorage(options, callback) {
    var self = this;

    MongoStorage.apply(self, arguments);

    self.collectionName = 'zetta-languages' || options.collectionName;

    self.type = self.TYPE_LANGUAGE;

    self.initCollection = function (callback) {
        self.database.createCollection(self.collectionName, {capped: true, max: 1, size: 4096}, function (err, collection) {
            if (err) return callback(err);

            self.collection = collection;

            callback();
        });
    }
}

util.inherits(LanguageMongoStorage, MongoStorage);

LanguageMongoStorage.prototype.getLanguages = function (callback) {
    var self = this;

    if (!self.collection) return callback(new Error('Language collection not found'));

    self.collection.findOne(function (err, doc) {
        if (err) return callback(err);

        if (!doc) return callback(null, {});

        callback(null, doc.languages);
    });
};

LanguageMongoStorage.prototype.setLanguages = function (data, callback) {
    var self = this;

    if (!self.collection) return callback(new Error('Language collection not found'));

    self.collection.findOne(function (err, doc) {
        if (err) return callback(err);

        if (!doc) {
            self.collection.insert({languages: data}, function (err) {
                if (err) return callback(err);

                self.emit('change', self);

                callback();
            });
        } else {
            self.collection.update({_id: doc._id}, {$set: {languages: data}}, function (err) {
                if (err) return callback(err);

                self.emit('change', self);

                callback();
            });
        }
    });
};


module.exports = LanguageMongoStorage;