var _ = require('underscore');

function SEO() {
    var self = this;

    /**
     *
     * Options:
     *  allowUserAgent:
     *  or
     *  denyUserAgent:
     *
     *  allowDirectory:
     *  or
     *  denyDirectory:
     *
     * @param options
     * @returns {Function}
     */
    self.robots = function (options) {
        options = options ? options : {};

        var text = '';
        var allowDirectory = '';
        var denyDirectory = '';

        if (options.allowDirectory) {
            // Disallow: /
            // Allow: /translator
            allowDirectory += '\nDisallow: /';

            options.allowDirectory.forEach(function (directory) {
                allowDirectory += '\nAllow: /' + directory;
            });
        } else if (options.denyDirectory) {
            // Disallow: /translator
            options.denyDirectory.forEach(function (directory) {
                denyDirectory += '\nDisallow: /' + directory;
            });
        }

        if (options.allowUserAgent) {
            // User-agent: *
            // Disallow: /
            // User-agent: Mediapartners-Google
            // Allow: /
            text += '\nUser-agent: *';
            text += '\nDisallow: /';

            options.allowUserAgent.forEach(function (userAgent) {
                text += '\n\nUser-agent: ' + userAgent;

                if (allowDirectory) {
                    text += allowDirectory;
                } else if (denyDirectory) {
                    text += '\nAllow: /';
                    text += denyDirectory;
                } else {
                    text += '\nAllow: /';
                }
            });

        } else if (options.denyUserAgent) {
            // User-agent: BadBot
            // Disallow: /
            options.denyUserAgent.forEach(function (userAgent) {
                text += '\n\nUser-agent: ' + userAgent;

                if (allowDirectory) {
                    text += allowDirectory;
                } else if (denyDirectory) {
                    text += denyDirectory;
                } else {
                    text += '\nDisallow: /';
                }
            });
        } else {
            text += '\n\nUser-agent: *';

            if (allowDirectory) {
                text += allowDirectory;
            } else if (denyDirectory) {
                text += denyDirectory;
            } else {
                text += '\nAllow: /';
            }
        }

        var host = null;
        var sitemap = null;

        return function (req, res) {
            if (!host && options.host) {
                host = options.host;
            } else if (!host) {
                //host = req.host;
                host = req.headers.host;
            }

            if (!sitemap && options.sitemap) {
                sitemap = options.sitemap;
            } else if (!sitemap) {
                sitemap = 'http://' + host + '/sitemap.xml';
            }

            message = text;

            message += '\n\nHost: ' + host;
            message += '\nSitemap: ' + sitemap;

            res.end(message);
        }
    };

    /**
     *
     * Options:
     *  {
     *    baseUrl: 'example.com',
     *    displayDefaultLocale: true,
     *    data: [
     *        {
     *            url: '',
     *            changefreq: 'monthly',
     *            priority: 1
     *        },
     *        {url: 'user'},
     *        {url: 'profile'}
     *    ]
     *  }
     *
     * @param options
     * @returns {Function}
     */
    self.sitemap = function (core, options) {
        var data = options.data || {};
        var baseUrl = options.baseUrl;
        var displayDefaultLocale = options.displayDefaultLocale;

        return function (req, res, next) {
            res.contentType('text/xml');

            if (!baseUrl) {
                baseUrl = req.protocol + '://' + req.headers.host;
            }

            var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

            _.each(data, function (row) {
                _.each(core.getEnabledLanguages(), function (language, code) {
                    var url = row.url ? '/' + row.url : '';

                    xml += '<url>\n<loc>' + baseUrl + (!displayDefaultLocale && code == core.defaultLanguage ? url : '/' + code + url) + '</loc>\n';

                    if (row.lastmod) {
                        xml += '<lastmod>' + row.lastmod + '</lastmod>';
                    }
                    if (row.changefreq) {
                        xml += '<changefreq>' + row.changefreq + '</changefreq>';
                    }
                    if (row.priority) {
                        xml += '<priority>' + row.priority + '</priority>';
                    }

                    xml += '</url>\n';
                });
            });

            xml += '</urlset>';

            res.end(xml);
        }
    };
}

module.exports = new SEO;