var underscore = _.noConflict();

(function ($, _) {
    function App() {
        var self = this;

        self.locale = '';
        self.languages = {};
        self.searchString = null;

        self.baseUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;

        self.entries = {};
        self.itemsOnPage = null;

        self.init = function () {
            self.cacheElements();
            self.bindEvents();

            self.initAjax();

            self.getLanguages(function (err, languages) {
                if (err) return false;

                self.languages = languages;

                self.renderFilterLangButtons();
                self.renderUILanguages();
                self.renderEnablingLanguages();
            });

            self.getEntries(function (err, data) {
                if (err) return false;

                self.entries = data.entries;
                self.itemsOnPage = data.entriesOnPage;

                self.$itemsOnPage.find('[value= ' + self.itemsOnPage + ']').prop('selected', true);

                self.render(data);
            });
        };

        self.cacheElements = function () {
            self.$pageHeader = $('.page-header');
            self.$entryBox = $('#entry-list');
            self.$uiLanguageBox = $('#ui-language-list');
            self.$enablingLanguageBox = $('#enabling-language-list');

            self.$searchField = $('#search');
            self.$searchClearButton = $('#search-clear');
            self.$paginationBox = $('#pagination');
            self.$itemsOnPage = $('#items-on-page');
            self.$exportButton = $('#export');
            self.$importButton = $('#import');

            self.entryBoxTemplate = $('#entry-box-template').html();
            self.filerLangButtonBoxTemplate = $('#filter-language-button-box-template').html();
            self.uiLanguageTemplate = $('#ui-language').html();
            self.enablingLanguageTemplate = $('#enabling-language').html();
            self.removeEntryMessage = $('#remove-entry-message').html();
        };

        self.bindEvents = function () {
            $('body').on('click', '#filter button', self.filters);
            self.$enablingLanguageBox.on('click', 'label, input[type="checkbox"]', self.enablingLanguage);
            $('#close-enabling-language-list').on('click', function () {
                $('body').click();

                return false;
            });

            self.$exportButton.on('click', self.exports);
            self.$importButton.on('click', self.imports);

            self.$searchField.on('blur', self.search);
            self.$searchField.on('keydown', function (e) {
                if (e.which === keyCode.ENTER) {
                    e.stopPropagation();
                    $(e.target).blur();
                }
            });
            self.$searchClearButton.on('click', self.clearSearchField);

            self.$entryBox.on('click', '.translation', self.edit);
            self.$entryBox.on('click', '.toggleMultiline', self.toggleMultiline);
            self.$entryBox.on('click', '.remove', self.remove);
            self.$entryBox.on('click', '.input', function (e) {
                e.stopPropagation();
            });
            self.$entryBox.on('blur', '.input', self.update);
            self.$entryBox.on('keydown', 'input[type=text].input', function (e) {
                if (e.which == keyCode.ENTER || e.which == keyCode.ESCAPE) {
                    e.stopPropagation();
                    $(e.target).blur();
                }
            });
            self.$entryBox.on('keydown', 'textarea.input', function (e) {
                if (e.which == keyCode.ESCAPE) {
                    e.stopPropagation();
                    $(e.target).blur();
                }
            });

            self.$itemsOnPage.on('change', function (e) {
                self.itemsOnPage = $(e.target).val();

                self.getEntries(self.searchString, null, self.itemsOnPage, function (err, data) {
                    if (err) return false;

                    self.entries = data.entries;

                    self.render(data);
                });
            });
        };

        self.initAjax = function () {
            $(document).ajaxError(function (event, jqXHR) {
                if (jqXHR.status === 0 || jqXHR.readyState === 0) {
                    alert('Cannot connect to server. Please try again later.');
                    return;
                }

                switch (jqXHR.status) {
                    case 403:
                        window.location.reload();
                        break;

                    case 500:
                        alert('Temporary server error. Please try again later.');
                        break;
                }
            });
        };

        self.getBaseUrl = function () {
            if (self.baseUrl.slice(-1) == '/') {
                self.baseUrl = self.baseUrl.slice(0, -1);
            }

            return self.baseUrl;
        };

        self.getEntryUrl = function () {
            return self.getBaseUrl() + '/entry/';
        };

        self.render = function (data) {
            self.renderEntries(data.entries);

            self.renderPaginator(data.totalNumber, self.itemsOnPage);
        };

        self.renderEntries = function (entries) {
            self.$entryBox.empty();

            var htmlParts = [];
            var sortedEntries = [];

            _.each(entries, function (entry) {
                if (entry.files) {
                    entry.__files = entry.files.join('|');
                }

                sortedEntries.push(entry);
            });

            sortedEntries = _.sortBy(sortedEntries, '__files');

            _.each(sortedEntries, function (entry) {
                var html = self.renderEntry(entry);

                htmlParts.push(html);
            });

            self.$entryBox.html(htmlParts.join(''));
        };

        self.renderFilterLangButtons = function () {
            self.$pageHeader.prepend(_.template(self.filerLangButtonBoxTemplate, {languages: self.languages}));
        };

        self.renderUILanguages = function () {
            self.$uiLanguageBox.html(_.template(self.uiLanguageTemplate, {languages: self.languages, url: self.getBaseUrl() + '/locale/'}));
        };

        self.renderEnablingLanguages = function () {
            self.$enablingLanguageBox.html(_.template(self.enablingLanguageTemplate, {languages: self.languages, url: self.getBaseUrl() + '/enable/'}));
        };

        self.renderEntry = function (entry) {
            var data = {
                entry: entry,
                languages: self.languages
            };
            entry._multiline = entry.multiline ? 'multiline' : '';
            entry._orphan = entry.orphan ? 'orphan' : '';
            entry._files = entry.files ? entry.files.join(' | ') : '';

            return _.template(self.entryBoxTemplate, data);
        };

        self.renderPaginator = function (totalNumber, itemsOnPage) {
            var pageNumber = Math.ceil(totalNumber / itemsOnPage);

            var options = {
                currentPage: 1,
                numberOfPages: 10,
                totalPages: pageNumber,
                bootstrapMajorVersion: 3,
                alignment: 'center',
                onPageChanged: function (event, oldPage, newPage) {
                    var skip = (newPage - 1) * itemsOnPage;

                    self.getEntries(self.searchString, skip, itemsOnPage, function (err, data) {
                        if (err) return false;

                        self.entries = data.entries;

                        self.renderEntries(data.entries);
                    });
                },
                shouldShowPage: function (type) {
                    switch (type) {
                        case "first":
                        case "last":
                            return true;
                        default:
                            return true;
                    }
                }
            };

            self.$paginationBox.bootstrapPaginator(options);
        };

        self.search = function (e) {
            var q = $(e.target).val();

            self.searchString = q;

            self.getEntries(q, function (err, data) {
                if (err) return false;

                self.entries = data.entries;

                self.render(data);

                $('#languages-switcher button').first().click();
            });
        };

        self.clearSearchField = function () {
            self.$searchField.val('');
            self.$searchField.trigger('blur');

            return false;
        };

        self.enablingLanguage = function (e) {
            var $button = $(e.target);

            if ($button.is('input[type="checkbox"]')) {
                $button = $button.parent();
            }

            var url = $button.data('href');

            $.ajax({
                url: url,
                type: 'GET',
                dataType: "json"
            }).done(function (data) {
                $button.find('input').prop('checked', data.enabled);
            }).fail(function (jqXHR) {
                console.error(jqXHR.statusText);
            });

            return false;
        };

        self.filters = function (e) {
            var $button = $(e.target);
            var locale = $button.data('locale');

            self.languages[locale].hide = !$button.hasClass('active');

            self.renderEntries(self.entries);
        };

        self.edit = function (e) {
            e.preventDefault();

            var tr = $(e.target);
            if (tr.children('.input').length) return false;

            if (tr.parent('.field').hasClass('original')) return false;

            var $container = $(e.target).parents('.entry');
            var hash = $container.data('id');
            var entry = self.entries[hash];
            var message = tr.html();

            $container.addClass('edit');

            if (entry.multiline) {
                tr.html('<textarea class="input">' + _.escape(message) + '</textarea>');
            } else {
                tr.html('<input class="input" type="text" value="' + _.escape(message) + '"/>');
            }

            var $input = $(".input", e.target);

            $input.autoResize(); // for auto resize of textarea

            $input.focus();
        };

        self.update = function (e) {
            var $input = $(e.target);

            var $container = $(e.target).parents('.entry');
            var hash = $container.data('id');

            $container.removeClass('edit');

            var message = _.unescape($input.val()).trim();

            var $tr = $input.parent('.translation');
            var locale = $tr.data('locale');

            var entry = self.entries[hash];

            if (message.length) {
                var oldMessage = entry.locale[locale];
                entry.locale[locale] = message;

                self.updateEntry(hash, locale, function (err) {
                    if (err) {
                        entry.locale[locale] = oldMessage;
                    }

                    $tr.html(entry.locale[locale]);
                });
            } else {
                $tr.html(entry.locale[locale] || '');
            }
        };

        self.toggleMultiline = function (e) {
            e.preventDefault();

            var $container = $(e.target).parents('.entry');
            var hash = $container.data('id');

            var entry = self.entries[hash];

            toggle();

            self.updateEntry(hash, null, function (err) {
                if (err) {
                    toggle();
                }
            });

            function toggle() {
                entry.multiline = entry.multiline ? false : true;

                if (entry.multiline) {
                    $container.addClass('multiline');
                } else {
                    $container.removeClass('multiline');
                }
            }
        };

        self.remove = function (e) {
            e.preventDefault();

            var $container = $(e.target).parents('.entry');
            var hash = $container.data('id');

            var entry = self.entries[hash];

            var message = entry.locale[entry.original].substring(0, 24);

            if (confirm(_.template(self.removeEntryMessage, {message: message}))) {
                self.removeEntry(hash, function (err) {
                    if (err) return false;

                    delete self.entries[hash];
                    $container.remove();
                });
            }
        };

        self.getLanguages = function (callback) {
            $.ajax({
                url: self.getBaseUrl() + '/languages',
                type: 'GET',
                dataType: "json"
            }).done(function (data) {
                callback(null, data);
            }).fail(function (jqXHR) {
                callback(jqXHR.statusText);
            });
        };

        self.getEntries = function (query, skip, limit, callback) {
            if (typeof query === 'function') {
                callback = query;
                query = null;
            } else if (typeof skip === 'function') {
                callback = skip;
                skip = null;
            } else if (typeof limit === 'function') {
                callback = limit;
                limit = null;
            }

            var url = self.getEntryUrl() + '?q=';
            url += query ? encodeURIComponent(query) : '';

            url += '&skip=' + (skip ? encodeURIComponent(skip) : '');
            url += '&limit=' + (limit ? encodeURIComponent(limit) : '');

            $.ajax({
                url: url,
                type: 'GET',
                dataType: "json"
            }).done(function (data) {
                callback(null, data);
            }).fail(function (jqXHR) {
                callback(jqXHR.statusText);
            });
        };

        self.updateEntry = function (hash, locale, callback) {
            var entry = {
                hash: hash,
                locale: {}
            };

            if (locale) {
                entry.locale[locale] = self.entries[hash].locale[locale];
            }

            entry.multiline = self.entries[hash].multiline;

            $.ajax({
                url: self.getEntryUrl(),
                type: 'PUT',
                dataType: "json",
                data: entry

            }).done(function (data) {
                callback(null, data);
            }).fail(function (jqXHR) {
                callback(jqXHR.statusText);
            });
        };

        self.removeEntry = function (hash, callback) {
            $.ajax({
                url: self.getEntryUrl() + hash,
                type: 'DELETE',
                dataType: "json"
            }).done(function () {
                callback(null);
            }).fail(function (jqXHR) {
                callback(jqXHR.statusText);
            });
        };

        self.exports = function (e) {
            var url = self.getBaseUrl() + '/export';
            var $self = $(e.target);

            if (!$self.hasClass('disabled')) {
                self.disableExportImport();

                doRequest();
            }

            return false;

            function doRequest() {
                $.ajax({
                    url: url,
                    type: 'GET',
                    dataType: 'json',
                    cache: false,
                    timeout: 60000
                }).done(function () {
                    alert('Data are exported to Transifex.');
                }).fail(function (jqXHR) {
                    if (jqXHR.status == 405) {
                        alert('Export to Transifex is not configured. \n Please contact the administrator.');
                    }
                }).always(function () {
                    self.enableExportImport();
                });
            }
        };

        self.imports = function (e) {
            var url = self.getBaseUrl() + '/import';
            var $self = $(e.target);

            if (!$self.hasClass('disabled')) {
                self.disableExportImport();

                doRequest();
            }

            return false;

            function doRequest() {
                $.ajax({
                    url: url,
                    type: 'GET',
                    dataType: 'json',
                    cache: false,
                    timeout: 60000
                }).done(function () {
                    alert('Data are imported from Transifex. \n Please reload the page.');
                }).fail(function (jqXHR) {
                    if (jqXHR.status == 405) {
                        alert('Import from Transifex is not configured. \n Please contact the administrator.');
                    }
                }).always(function () {
                    self.enableExportImport();
                });
            }
        };

        self.enableExportImport = function () {
            self.$exportButton.removeClass('disabled');
            self.$importButton.removeClass('disabled');
        };

        self.disableExportImport = function () {
            self.$exportButton.addClass('disabled');
            self.$importButton.addClass('disabled');
        };
    }

    var keyCode = {
        ENTER: 13,
        ESCAPE: 27
    };

    $(function () {
        console.log('app initialization');

        _.templateSettings = {
            evaluate: /\{\{ ([\s\S]+?) \}\}/g, // {{# console.log("blah") }}
            interpolate: /\{\{=(.+?)\}\}/g,
            escape: /\{\{-(.+?)\}\}/g
        };

        new App().init();
    });


    var noop = function () {
    };
    var console = (window.console = window.console || {});
    if (!console.log) {
        console.log = noop;
    }
    if (!console.error) {
        console.error = noop;
    }

})(jQuery, underscore);