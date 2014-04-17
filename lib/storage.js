var fs = require('fs');
var mkpath = require('mkpath');

function Storage (options) {
    this._directory = options.directory || __dirname + '/../locales';
    this._filename = options.filename || 'default';
    this._verified = false;

    //if (!options.fileName) throw Error('File name is required');
};

Storage.prototype.getData = function (callback) {
    fs.readFile(this._getStorage(), {encoding: 'utf8'}, function (err, data) {
        if (err) {
            console.error(err);
            return callback(null);
        }

        callback(JSON.parse(data.toString('utf8')));
    });
};

Storage.prototype.setData = function (object, callback) {
    this.setString(JSON.stringify(object, null, '\t'), callback);
};

Storage.prototype.setString = function (string, callback) {
    fs.writeFile(this._getStorage(), string, {encoding: 'utf8'}, function (err) {
        if (err) {
            console.error(err);
        }

        callback(err);
    });
}

Storage.prototype.setDirectory = function (path) {
    this._directory = path;
    this._verified = false;
};

Storage.prototype.getDirectory = function () {
    return this._directory;
}

Storage.prototype.setFilename = function (filename) {
    this._filename = filename;
};

Storage.prototype.getFilePath = function () {
    return getFilePath(this._directory, this._filename);
};

Storage.prototype._getStorage = function () {
    var filePath = getFilePath(this._directory, this._filename);

    if (this._verified) return filePath;

    if (checkDirectory(this._directory)) {
        this._verified = true;
        return filePath;
    }

    throw new Error('Storage directory not found');
};

function getFilePath(directory, fileName) {
    if (directory.slice(-1) == '/') {
        directory = directory.slice(0, -1);
    }

    return directory + '/' + fileName;
}

function checkDirectory(directory) {
    // creating directory if necessary
    try {
        if (!fs.existsSync(directory)) {
            try {
                mkpath.sync(directory, 0755);
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

module.exports = function (options) {
    return new Storage(options ? options : {});
}