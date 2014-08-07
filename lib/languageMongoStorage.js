var MongoStorage = require('./mongoStorage');
var util = require('util');

function LanguageMongoStorage(options, callback) {
    var self = this;

    MongoStorage.apply(self, arguments);

    self.collectionName = 'zetta-languages' || options.collectionName;

    self.type = self.TYPE_LANGUAGE;

    self.singleDocumentId = 'ddcb77ff769ea11111111edd4004fa4f4fa';
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

    self.collection.findOne({_id: self.singleDocumentId}, function (err, doc) {
        if (err) return callback(err);

        if (!doc) {
            self.collection.insert({_id: self.singleDocumentId, languages: data}, function (err) {
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