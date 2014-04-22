var Storage = require('./storage');
var _ = require('underscore');
//var config = require('./config');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');

String.prototype.strtr = function (replacePairs) {
    var str = this.toString(), key, re;

    for (key in replacePairs) {
        if (replacePairs.hasOwnProperty(key)) {
            re = new RegExp(key, "g");
            str = str.replace(re, replacePairs[key]);
        }
    }
    return str;
};

//var i18n = module.exports = {
function i18n() {
    var self = this;

    self.entries = { }

    self.storage = new Storage();

    /**
     * the language that the source messages are written in
     */
    self.sourceLanguage = 'en';
    self.secondaryLanguage ='it';
    self.secondaryLanguageTpl = '--{text}--';
    self.basicCategory = 'basic';

    self.fileExtensions = ['js', 'ejs'];
    self.folderFileExtensions = [];
    self.filename = 'translation';

    self.init = function (opt, callback) {
        if (opt.sourceLanguage) {
            this.sourceLanguage = opt.sourceLanguage;
        }
        self.storage.setFilename(this.filename);

        if (opt.storagePath) {
            self.storage.setDirectory(opt.storagePath);
        }

        this.providerRootFolderPath = opt.rootFolderPath ? opt.rootFolderPath + '/' : __dirname + '/../';
        this.providerFolders = opt.folders;

        if (_.isArray(opt.fileExtensions)) {
            this.fileExtensions = opt.fileExtensions;
        }

        this.importFromFolder(callback);
    }

    self.refreshEntries = function (callback) {
        var self = this;

        self.storage.getData(function (entries) {
            if (!entries) return callback(null);

            _.each(entries, function (entry) {
                merge_entry(entry);
            })

            callback();
        });

        function merge_entry(entry) {
            if (!self.entries[entry.hash]) {
                self.entries[entry.hash] = entry;
            } else {
                var o = self.entries[entry.hash];

                _.each(entry.files, function (file) {
                    if (file && !_.contains(o.files, file))
                        o.files.push(file);
                })

                _.each(entry.locale, function (message, code) {
                    //if (!o.locale[code]) {
                        o.locale[code] = message;
                    //}
                });
            }
        }
    }

    self.storeEntries = function (callback) {
        self.storage.setData(this.entries, callback);
    }

    /**
     * Translates a message
     *
     * Messages can contain parameter placeholders which will be replaced with the actual parameter values
     *
     * @param message {String} the original message for translation
     * @param params {Object} parameters to be applied to the message
     * @param category {String} If null, the basic category will be used.
     * @param locale {String} the target language. If null, the source language will be used.
     * @returns {String} the translated message
     */
    self.translate = function (message, params, category, locale) {
        var self = this;

        var locale = locale || self.sourceLanguage;

        var hash = crypto.createHash('sha1').update(message).digest('hex');
        var entry = self.entries[hash];

        if (entry) {
            if (entry.category == self.basicCategory && category) {
                entry.category = category;
            }

            entry.orphan = false;

            message = entry.locale[locale] || message;
        } else {
            var file = '';
            try{
                Error.prepareStackTrace =  function(error, r){
                    _.each(r, function(e){
                        var fnBody = e.getFunction().toString();
                        if(fnBody.indexOf('_T("'+message+'")')>-1 || fnBody.indexOf("_T('"+message+"')")>-1){
                            file = e.getFileName();
                        }
                        //console.log(e.getFileName() , e.getMethodName(),  e.getFunctionName() );
                    });
                }
                new Error().stack;
                if(file){
                    file = self.getRelativePath(file);
                }
            }catch(e){
                //console.log(e)
            }

            //console.log('file:'+file)
            self.createEntry(message, category, file);
            self.storeEntries(function(){});
        }

        if (params) {
            message = message.strtr(params);
        }

        return message;
    }

    self.getRelativePath = function(file){
        file = path.relative(__dirname, file).replace(/\\/g, '/');
        while(file.substring(0,2)=='..'){
            file = file.substring(3);
        }
        return file;
    }

    self.createEntry = function (message, category, file) {
        var self = this;

        var hash = crypto.createHash('sha1').update(message).digest('hex');

        if (!self.entries[hash]) {
            var locale = {};
            locale[self.sourceLanguage] = message;
            if(self.secondaryLanguage){
                locale[self.secondaryLanguage] = self.secondaryLanguageTpl.replace('{text}', message);
            }
            var category = category ? category : self.basicCategory;

            var files = file ? [file.replace(self.providerRootFolderPath, '')] : [];

            self.entries[hash] = {
                hash: hash,
                category: category,
                locale: locale,
                original: self.sourceLanguage,
                files: files,
                multiline: false,
                orphan: false
            };

            console.log('Creating new entry', message);
        } else {
            var entry = self.entries[hash];

            entry.orphan = false;

            file = file.replace(self.providerRootFolderPath, '');

            if (file && !_.contains(entry.files, file)) {
                entry.files.push(file);
            }
        }
    }

    self.importFromFolder = function (callback) {
        var self = this;

        console.log("Translation import...");
        if(!_.isArray(self.providerFolders)){
            var tmpFolder = [];
            var tmpExtensions = [];
            _.each(self.providerFolders, function(ext, folder){
                tmpFolder.push(folder);
                tmpExtensions.push(ext.split(','));
            });
            var folders = tmpFolder;
            self.folderFileExtensions = tmpExtensions;
        }else{
            var folders = self.providerFolders.slice();
        }
        self.refreshEntries(function () {
            _.each(self.entries, function (entry) {
                entry.orphan = true;
            });
        });

//        console.log("Translation digesting folders:", folders, self.folderFileExtensions);

        scanFolders(self.providerRootFolderPath, folders, self.folderFileExtensions.slice() , function (err, files) {
            if (err) return callback(err, self.entries);

            digestFiles(files, function (err) {
                self.storeEntries(function () {
                    callback(err, self.entries);
                    return;
                    /*var orphanEntries = [];
                    _.each(self.entries, function (entry) {
                        if(entry.orphan){
                            orphanEntries.push(entry)
                        }
                    });
                    function digestOrphanEntryFile(err){
                        var entry = orphanEntries.pop();
                        if(err){
                            callback(err, self.entries);
                            return;
                        }
                        if(!entry){
                            _.each(self.entries, function (entry) {
                                var files = entry.files.map(function(i){return self.getRelativePath(i)});
                                console.log('RelativePath Fixed files:', files)
                                //entry.files = files;
                            });
                            self.storeEntries(function(err){
                                callback(err, self.entries);
                            });
                            return;
                        }
                        var files = entry.files.map(function(i){return path.join(__dirname, '../'+i)});
                        entry.files = [];
                        console.log('orphan entries: ', entry, files)
                        digestFiles(files, function (err) {
                            digestOrphanEntryFile(err);
                        });
                    }
                    digestOrphanEntryFile(err);
                    */
                });
            });
        });
    }

    self.getFilePath = function () {
        return self.storage.getFilePath();
    }

    self.getLanguage = function () {

    }

    /**
     * Sets the language that the source messages are written in
     *
     * @param language
     */
    self.setLanguage = function (locale) {

    }

    /**
     * Raised when a message cannot be translated
     *
     * @param callback {Function}
     */
    self.onMissingTranslation = function (callback) {

    }


    //////////////////////////////////////////////

    // Private functions

    /**
     * Gets files from folders
     *
     * @param rootFolderPath
     * @param folders {Array}
     * @param callback
     *
     * @return {Array} array of files
     */
    function scanFolders(rootFolderPath, folders, folderFileExtensions, callback) {
        var result = [];

        console.log('Scanning:: Folders', folders);
        console.log('Scanning:: Root folder path', rootFolderPath);
        var fileExtensions = self.fileExtensions.slice();
        scanFolder();

        function scanFolder() {
            var folder = folders.shift();
            if (folder === undefined) {
//                console.log('Scanning:: Finished with result', result);
                return callback(null, result);
            }
            if(folderFileExtensions.length){
                fileExtensions = folderFileExtensions.shift();
            }
            //var path = rootFolderPath + '/' + folder;
            var path = rootFolderPath + folder;

            console.log('Scanning:: Full path to folder', path, fileExtensions);

            fs.readdir(path, function (err, list) {
                if (err) {
                    console.error("Error scanning folder: ", path);
                    return scanFolder();
                }

                var files = [];

                for (var i = 0; i < list.length; i++) {
                    if (acceptFile(path, list[i], fileExtensions)) {
                        //files.push((folder.length ? folder + '/' : folder) + list[i]);
                        files.push(path + '/' + list[i]);
                    }
                }

                result = result.concat(files);

                scanFolder();
            });
        }
    }

    function acceptFile(path, relative, fileExtensions) {

        if (!relative || !relative.length) return false;

        if (relative.charAt(0) == '.') return false;

        if (fs.statSync(path + '/' + relative).isDirectory()){
            return false;
        }

        var ext = relative.split('.').pop();

        if (_.contains(fileExtensions, ext))
            return true;

        return false;
    }

    function digestFiles(files, callback) {
        digest();

        function digest() {
            var file = files.shift();

            if (!file) return callback();

            digestFile(file, function (err) {
                if (err) return callback(err);

                digest();
            });
        }
    }

    function digestFile(file, callback) {
//        console.log('Digesting file', file);

        fs.readFile(file, {encoding: 'utf8'}, function (err, data) {
            if (err) {
                console.log(err, file);
                return callback(null);
            }

            data = data.toString('utf8');

            var matches = [];

            // syntax _T("It's wonderful life")
            matches = matches.concat(data.match(/_T\(\"[^\"]+\"\)/gi));
            matches = matches.concat(data.match(/_T\(\'[^\']+\'\)/gi));

            _.each(matches, function (match) {
                if (match) {
                    self.createEntry(match.substring(4, match.length - 2), '', file);
                }
            });

            var matches = [];

            // syntax 'Hello world'._T()
            matches = matches.concat(data.match(/\'[^\']+\'._T/gi));
            matches = matches.concat(data.match(/\"[^\"]+\"._T/gi));

            _.each(matches, function (match) {
                if (match) {
                    self.createEntry(match.substring(1, match.length - 4), '', file);
                }
            });

            callback();
        })
    }    
}

module.exports = i18n;
