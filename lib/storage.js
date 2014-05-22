var fs = require('fs');
var mkpath = require('mkpath');
var path = require('path');

function Storage (options) {
    if(!options.storagePath)
        throw new Error("Translator requires storagePath option");
    this._storagePath = options.storagePath;
    this._filename = options.filename || 'default';
    this._verified = false;
};

Storage.prototype.getData = function (callback) {
    var self = this;
    fs.readFile(self._getStorage(), {encoding: 'utf8'}, function (err, data) {
        if (err) {
            console.error("Could not read file:", self._getStorage());
            return callback(null);
        }

        data = data.toString('utf8');

        if (!data.length) {
            data = {};
        } else {
            try {
                data = !data.length ? {} : JSON.parse(data);
            } catch(e) {
                data = {};
            }
        }

        callback(data);
    });
};

Storage.prototype.setData = function (object, callback) {
    this.setString(JSON.stringify(object, null, '\t'), callback);
};

Storage.prototype.setString = function (string, callback) {
    var self = this;
    fs.writeFile(this._getStorage(), string, {encoding: 'utf8'}, function (err) {
        if (err) {
            console.error("Could not write to file:", self._getStorage());
        }

        callback(err);
    });
}

Storage.prototype.setFilename = function (filename) {
    this._filename = filename;
};

Storage.prototype.getFilePath = function () {
    return path.join(this._storagePath, this._filename);
};

Storage.prototype._getStorage = function () {
    var filePath = this.getFilePath();

    if (this._verified) return filePath;

    if (checkStoragePath(this._storagePath)) {
        this._verified = true;
        return filePath;
    }

    throw new Error('Storage directory not found');
};

Storage.prototype.fileExists = function (callback) {
    fs.exists(this._getStorage(), callback);
};

Storage.prototype.createFile = function (callback) {
    var self = this;

    fs.stat(self._storagePath, function (err, stats) {
        if (err) {
            if (err.code === 'ENOENT') {
                mkpath(path.dirname(self._storagePath), 0755, function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        fs.open(self._getStorage(), 'w', 0664, callback);
                    }
                });
            } else {
                callback(err);
            }
        } else if (stats.isDirectory()) {
            fs.open(self._getStorage(), 'w', 0664, callback);
        } else {
            callback(new Error('Wrong storage pat: ' + self._storagePath));
        }
    });
};

function checkStoragePath(storagePath) {
    // creating directory if necessary
    try {
        if (!fs.existsSync(storagePath)) {
            try {
                mkpath.sync(storagePath, 0755);
            } catch (err) {
                console.error(err);
                return false;
            }
        }
    } catch (err) {
        console.error(err);
        return false;
    }

    return true;
}

module.exports = Storage;
