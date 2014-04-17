var underscore = _.noConflict();

(function ($, _) {
    var app = {
        init: function () {
            var self = this;
            this.locale = '';
            this.languages = [];
            this.searchString = null;

            //this.baseUrl = document.URL;
            this.baseUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;

            this.entries = {};


            this.$pageHeader = $('.page-header');
            this.$entryBox = $('#entry-list');
            this.$uiLanguageBox = $('#ui-language-list');
            this.$enablingLanguageBox = $('#enabling-language-list');

            this.langButtonBoxTemplate = $('#language-button-box-template').html();
            this.entryBoxTemplate = $('#entry-box-template').html();
            this.addLanguageBoxTemplate = $('#add-language-box-template').html();
            this.newLanguageBoxTemplate = $('#new-language-box-template').html();
            this.uiLanguageTemplate = $('#ui-language').html();
            this.enablingLanguageTemplate = $('#enabling-language').html();
            this.removeLocaleTemplate = $('#remove-locale').html();

            this.removeEntryMessage = $('#remove-entry-message').html();
            this.extraLanguageNotFoundMessage = $('#languages-not-found-message').html();

            this.$paginationBox = $('#pagination');

            this.$exportButton = $('#export');
            this.$importButton = $('#import');

            // binds handlers
            $('body').on('click', '#languages-switcher button', this.switchLanguageDisplay);
            $('#enabling-language-list').on('click', 'label', this.enablingLanguage);
            $('body').on('click', '#export', this.exports);

            var $search = $('#search');
            $search.on('blur', this.search);
            $search.on('keydown', function (event) {
                if (event.which == keyCode.ENTER) {
                    event.stopPropagation();
                    $(this).blur();
                }
            });

            this.$entryBox.on('click', '.translation', this.edit);
            this.$entryBox.on('click', '.toggleMultiline', this.toggleMultiline);
            this.$entryBox.on('click', '.add', this.add);
            this.$entryBox.on('click', '.remove', this.remove);
            this.$entryBox.on('click', '.remove-locale', this.deleteLocale);
            this.$entryBox.on('click', '.input', function (event) {
                event.stopPropagation();
            });
            this.$entryBox.on('blur', '.input', this.update);
            this.$entryBox.on('click', '.save', this.saveNewTranslation);
            this.$entryBox.on('click', '.cancel', this.cancelNewTranslation);
            this.$entryBox.on('keydown', 'input[type=text].input', function (event) {
                if (event.which == keyCode.ENTER || event.which == keyCode.ESCAPE) {
                    event.stopPropagation();
                    $(this).blur();
                }
            });
            this.$entryBox.on('keydown', 'textarea.input', function (event) {
                if (event.which == keyCode.ESCAPE) {
                    event.stopPropagation();
                    $(this).blur();
                }
            });


            this.initAjax();

            this.getLanguages(function (err, languages) {
                if (err) return false;

                self.languages = languages;

                self.renderLangButtons();
                self.renderUILanguages();
                self.renderEnablingLanguages();
            });

            this.getEntries(function (err, data) {
                if (err) console.log(err);

                self.entries = data.entries;

                self.render(data);
            });
        },

        getEntryUrl: function () {
            return this.getBaseUrl() + '/entry';
        },

        getBaseUrl: function () {
            if (this.baseUrl.slice(-1) == '/') {
                this.baseUrl = this.baseUrl.slice(0, -1);
            }

            return this.baseUrl;
        },

        initAjax: function () {
            $(document).ajaxError(function (event, request, settings) {
                switch (request.status) {
                    case 403:
                        window.location.reload();
                        break;
                }
            });
        },

        render: function (data) {
            this.renderEntries(data.entries);

            this.renderPaginator(data.totalNumber, data.entriesOnPage);
        },

        renderEntries: function (entries) {
            var self = this;
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
        },

        renderLangButtons: function () {
            this.$pageHeader.prepend(_.template(this.langButtonBoxTemplate, {languages: this.languages}));
        },

        renderUILanguages: function () {
            this.$uiLanguageBox.html(_.template(this.uiLanguageTemplate, {languages: this.languages, url: this.getBaseUrl() + '/locale/'}));
        },

        renderEnablingLanguages: function () {
            this.$enablingLanguageBox.html(_.template(this.enablingLanguageTemplate, {languages: this.languages, url: this.getBaseUrl() + '/enable/'}));
        },

        renderEntry: function (entry) {
            entry._multiline = entry.multiline ? 'multiline' : '';
            entry._orphan = entry.orphan ? 'orphan' : '';
            entry._files = entry.files ? entry.files.join(' | ') : '';

            return _.template(this.entryBoxTemplate, entry);
        },

        renderPaginator: function (totalNumber, itemsOnPage) {
            var self = this;
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
                        if (err) console.log(err);

                        self.entries = data.entries;

                        self.renderEntries(data.entries);
                    });
                },
                shouldShowPage: function (type, page, current) {
                    switch (type) {
                        case "first":
                        case "last":
                            return true;
                        default:
                            return true;
                    }
                }
            }

            this.$paginationBox.bootstrapPaginator(options);
        },

        search: function (event) {
            var q = $(this).val();

            app.searchString = q;

            app.getEntries(q, function (err, data) {
                if (err) console.log(err);

                app.entries = data.entries;

                app.render(data);

                $('#languages-switcher button').first().click();
            });
        },

        enablingLanguage: function (event) {
            var $button = $(this);

            $.ajax({
                url: $button.data('href'),
                type: 'GET',
                dataType: "json"
            }).done(function (data) {
                $button.find('input').prop('checked', data.enabled);
            }).fail(function (jqXHR) {
                console.error(jqXHR.statusText);
            });

            return false;
        },

        switchLanguageDisplay: function (event) {
            var $button = $(this);
            var $buttons = $button.parent('div').find('button');

            // click on all languages button
            if (!$button.data('locale')) {
                if (!$button.hasClass('active')) {
                    $('.field').removeClass('hidden');
                    $buttons.removeClass('active');
                } else {
                    return false;
                }
            } else {
                var locale = $button.data('locale');
                var $allLanguageButton = $buttons.filter(':not([data-locale])');

                if (!$button.hasClass('active')) {
                    if ($allLanguageButton.hasClass('active')) {
                        $allLanguageButton.removeClass('active');
                        $('.field[data-locale != "' + locale + '"]').addClass('hidden');
                    } else {
                        $('.field[data-locale = "' + locale + '"]').removeClass('hidden');
                    }
                } else {
                    if ($buttons.filter('.active').length == 1) {
                        $allLanguageButton.click();
                        return false;
                    } else {
                        $('.field[data-locale = "' + locale + '"]').addClass('hidden');
                    }
                }
            }

            var entry = $('.entry');
            entry.has('.field.hidden').hide();
            entry.has('.field:not(.hidden)').show();
        },

        edit: function (event) {
            event.preventDefault();

            var tr = $(this);
            if (tr.children('.input').length) return false;

            var $container = $(this).parents('.entry');
            var hash = $container.data('id');
            var entry = app.entries[hash];

            $container.addClass('edit');

            var message = tr.html();

            if (entry.multiline) {
                tr.html('<textarea class="input">' + _.escape(message) + '</textarea>');
            } else {
                tr.html('<input class="input" type="text" value="' + _.escape(message) + '"/>');
            }

            var $input = $(".input", this);

            $input.autoResize(); // for auto resize of textarea

            $input.focus();
        },

        update: function (event) {
            var $input = $(this);

            var $container = $(this).parents('.entry');
            var hash = $container.data('id');

            $container.removeClass('edit');

            var message = _.unescape($input.val());
            message = message.trim();

            var $tr = $input.parent('.translation');
            var locale = $tr.data('locale');

            var entry = app.entries[hash];

            if (message.length) {
                $tr.html(message);

                app.entries[hash].locale[locale] = message;

                app.updateEntry(hash, locale, function (err) {
                    if (err) return alert(err);
                });
            } else {
                $tr.html(app.entries[hash].locale[locale]);
            }
        },

        toggleMultiline: function (event) {
            event.preventDefault();

            $('.cancel').click();

            var $container = $(this).parents('.entry');
            var hash = $container.data('id');

            var entry = app.entries[hash];
            entry.multiline = entry.multiline ? false : true;

            if (entry.multiline) {
                $container.addClass('multiline');
            } else {
                $container.removeClass('multiline');
            }

            app.updateEntry(hash, null, function () {
            });
        },

        add: function (event) {
            event.preventDefault();

            $('.cancel').click();

            var $container = $(this).parents('.entry');

            var hash = $container.data('id');
            var entry = app.entries[hash];

            var existingLanguages = _.keys(app.entries[hash].locale);
            var languages = _.keys(app.languages);
            var allowLanguages = _.difference(languages, existingLanguages);

            if (!allowLanguages.length) return alert(_.template(app.extraLanguageNotFoundMessage, {}));

            var input = '';
            if (entry.multiline) {
                input = '<textarea class="new-input col-xs-8"></textarea>';
            } else {
                input = '<input class="new-input col-xs-8" type="text"/>';
            }

            $container.append(_.template(app.addLanguageBoxTemplate, {
                languages: allowLanguages,
                input: input
            }));

            var $input = $container.find('.new-input');

            $input.autoResize(); // for auto resize of textarea

            $input.focus();
        },

        saveNewTranslation: function (event) {
            var $wrapper = $(this).parent('.new-language-box');

            var $container = $wrapper.parents('.entry');
            var hash = $container.data('id');

            var $input = $wrapper.find('.new-input');
            var locale = $wrapper.find('select').val();
            var message = _.unescape($input.val());

            $wrapper.remove();

            if (!message.length) {
                return false;
            }

            app.entries[hash].locale[locale] = message;

            app.updateEntry(hash, locale, function (err) {
                if (err) return alert(err);

                $container.find('.translation-box').append(_.template(app.newLanguageBoxTemplate, {
                    original: '',
                    locale: locale,
                    message: message
                }));
            });
        },

        cancelNewTranslation: function () {
            var $wrapper = $(this).parent('.new-language-box');
            $wrapper.remove();
        },

        remove: function (event) {
            event.preventDefault();

            var $container = $(this).parents('.entry');
            var hash = $container.data('id');

            var entry = app.entries[hash];

            var message = entry.locale[entry.original].substring(0, 24);

            if (confirm(_.template(app.removeEntryMessage, {message: message}))) {
                app.removeEntry(hash, function (err) {
                    if (err) return alert(err);

                    delete app.entries[hash];

                    $container.remove();
                });
            }
        },


        deleteLocale: function (event) {
            event.preventDefault();

            $self = $(this);

            var $entryContainer = $self.parents('.entry');
            var $container = $self.parents('.field');

            var hash = $entryContainer.data('id');
            var locale = $self.data('locale');

            var entry = app.entries[hash];

            var message = entry.locale[locale].substring(0, 24);

            if (confirm(_.template(app.removeLocaleTemplate, {message: message}))) {
                app.removeLocale(hash, locale, function (err) {
                    if (err) return alert(err);

                    delete app.entries[hash].locale[locale];

                    $container.remove();
                });
            }
        },

        getLanguages: function (callback) {
            $.ajax({
                url: this.getBaseUrl() + '/languages',
                type: 'GET',
                dataType: "json"
            }).done(function (data) {
                callback(null, data);
            }).fail(function (jqXHR) {
                callback(jqXHR.statusText);
            });
        },

        getEntries: function (query, skip, limit, callback) {
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

            var url = query ? this.getEntryUrl() + '/' + encodeURIComponent(query) : this.getEntryUrl();
            url += '?skip=' + (skip ? encodeURIComponent(skip) : '');
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
        },

        updateEntry: function (hash, locale, callback) {
            var entry = {
                hash: hash,
                locale: {}
            }

            if (locale) {
                entry.locale[locale] = this.entries[hash].locale[locale];
            }

            entry.multiline = this.entries[hash].multiline;

            $.ajax({
                url: this.getEntryUrl(),
                type: 'PUT',
                dataType: "json",
                data: entry

            }).done(function (data) {
                callback(null, data);
            }).fail(function (jqXHR) {
                callback(jqXHR.statusText);
            });
        },

        removeEntry: function (hash, callback) {
            $.ajax({
                url: this.getEntryUrl() + '/' + hash,
                type: 'DELETE',
                dataType: "json"
            }).done(function () {
                callback(null);
            }).fail(function (jqXHR) {
                callback(jqXHR.statusText);
            });
        },

        removeLocale: function (hash, locale, callback) {
            $.ajax({
                url: this.getEntryUrl() + '/' + hash + '/' + locale,
                type: 'DELETE',
                dataType: 'json'
            }).done(function () {
                callback(null);
            }).fail(function (jqXHR) {
                callback(jqXHR.statusText);
            });
        },

        exports: function (event) {
            var url = app.getBaseUrl() + '/export';
            var $self = $(this);

            if (!$self.hasClass('disabled')) {
                app.disableExportImport();

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
                    alert('Data are exported to Transifex');
                }).fail(function () {
                    alert('Data can not be exported to Transifex. \n Please contact the administrator');
                }).always(function () {
                    app.enableExportImport();
                });
            }
        },

        enableExportImport: function () {
            this.$exportButton.removeClass('disabled');
            this.$importButton.removeClass('disabled');
        },

        disableExportImport: function () {
            this.$exportButton.addClass('disabled');
            this.$importButton.addClass('disabled');
        }
    };

    var keyCode = {
        ENTER: 13,
        ESCAPE: 27
    };

    $(function () {
        console.log('app initialization');

        _.templateSettings = {
            evaluate: /\{\{ ([\s\S]+?) \}\}/g,            // {{# console.log("blah") }}
            // evaluate:    /\{\{#(.+?)\}\}/g,            // {{# console.log("blah") }}
            // interpolate: /\{\{[^#\{]([\s\S]+?)[^\}]\}\}/g,  // {{ title }}
            //interpolate: /\{\{(.+?)\}\}/g,
            //escape:      /\{\{\{([\s\S]+?)\}\}\}/g,         // {{{ title }}}

            //evaluate:    /\{\{ (.+?) \}\}/g,
            interpolate: /\{\{=(.+?)\}\}/g,
            escape: /\{\{-(.+?)\}\}/g
        };

        app.init();
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