"use strict";
/*
 * MetacatUI is a client application that supports the DataONE Service API
 * See https://purl.dataone.org/architecture for details
 *
 * Export the MetacatUI module into the global namespace
 */
MetacatUI = Object.assign((function() {

    /* The application object to export */
    return {

        /* Default to using D3 SVG rendering */
        useD3: true,

        /* Provide polyfills for older browsers */
        preventCompatabilityIssues: function() {
            // Detecting IE
            function isIE () {
                  var myNav = navigator.userAgent.toLowerCase();
                  return (myNav.indexOf("msie") != -1) ? parseInt(myNav.split("msie")[1]) : false;
            }
            //If IE 8 or earlier, don't use D3
            if (isIE() && (isIE() < 9)) MetacatUI.useD3 = false;

            /* Add trim() function for IE*/
            if (typeof String.prototype.trim !== "function") {
                String.prototype.trim = function() {
                    return this.replace(/^\s+|\s+$/g, "");
                }
            }

            /* Polyfill for startsWith() - IE 8 and earlier */
            if (!String.prototype.startsWith) {
                String.prototype.startsWith = function(searchString, position) {
                    position = position || 0;
                    return this.indexOf(searchString, position) === position;
                };
            }

            /* Polyfill for endsWith() - IE 8 and earlier */
            if (!String.prototype.endsWith) {
                String.prototype.endsWith = function(searchString, position) {
                    var subjectString = this.toString();
                    if (typeof position !== "number" || !isFinite(position) ||     Math.floor(position) !== position || position > subjectString.length) {
                        position = subjectString.length;
                    }
                    position -= searchString.length;
                    var lastIndex = subjectString.indexOf(searchString, position);
                    return lastIndex !== -1 && lastIndex === position;
                };
            }

            /* Polyfill for Array.isArray() - IE 8 and earlier */
            if (!Array.isArray) {
                Array.isArray = function(arg) {
                    return Object.prototype.toString.call(arg) === "[object Array]";
                };
            }

            /**
             * Protect window.console method calls, e.g. console is not defined on IE
             * unless dev tools are open, and IE doesn't define console.debug
             */
            (function() {
                if (!window.console) {
                    window.console = {};
                }
                // union of Chrome, FF, IE, and Safari console methods
                var m = [
                  "log", "info", "warn", "error", "debug", "trace", "dir", "group",
                  "groupCollapsed", "groupEnd", "time", "timeEnd", "profile",   "profileEnd",
                  "dirxml", "assert", "count", "markTimeline", "timeStamp", "clear"
                ];
                // define undefined methods as noops to prevent errors
                for (var i = 0; i < m.length; i++) {
                    if (!window.console[m[i]]) {
                        window.console[m[i]] = function() {};
                    }
                }
            })();

            //Add a polyfill for the .map() function for arrays for IE 8. Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
            // Production steps of ECMA-262, Edition 5, 15.4.4.19
            // Reference: http://es5.github.io/#x15.4.4.19
            if (!Array.prototype.map) {

                Array.prototype.map = function(callback, thisArg) {

                    var T, A, k;

                    if (this == null) {
                      throw new TypeError(" this is null or not defined");
                    }

                    // 1. Let O be the result of calling ToObject passing the |this|
                    //    value as the argument.
                    var O = Object(this);

                    // 2. Let lenValue be the result of calling the Get internal
                    //    method of O with the argument "length".
                    // 3. Let len be ToUint32(lenValue).
                    var len = O.length >>> 0;

                    // 4. If IsCallable(callback) is false, throw a TypeError exception.
                    // See: http://es5.github.com/#x9.11
                    if (typeof callback !== "function") {
                        throw new TypeError(callback + " is not a function");
                    }

                    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
                    if (arguments.length > 1) {
                      T = thisArg;
                    }

                    // 6. Let A be a new array created as if by the expression new Array(len)
                    //    where Array is the standard built-in constructor with that name and
                    //    len is the value of len.
                    A = new Array(len);

                    // 7. Let k be 0
                    k = 0;

                    // 8. Repeat, while k < len
                    while (k < len) {

                        var kValue, mappedValue;

                        // a. Let Pk be ToString(k).
                        //   This is implicit for LHS operands of the in operator
                        // b. Let kPresent be the result of calling the HasProperty     internal
                        //    method of O with argument Pk.
                        //   This step can be combined with c
                        // c. If kPresent is true, then
                        if (k in O) {

                            // i. Let kValue be the result of calling the Get internal
                            //    method of O with argument Pk.
                            kValue = O[k];

                            // ii. Let mappedValue be the result of calling the Call     internal
                            //     method of callback with T as the this value and argument
                            //     list containing kValue, k, and O.
                            mappedValue = callback.call(T, kValue, k, O);

                            // iii. Call the DefineOwnProperty internal method of A with     arguments
                            // Pk, Property Descriptor
                            // { Value: mappedValue,
                            //   Writable: true,
                            //   Enumerable: true,
                            //   Configurable: true },
                            // and false.

                            // In browsers that support Object.defineProperty, use the     following:
                            // Object.defineProperty(A, k, {
                            //   value: mappedValue,
                            //   writable: true,
                            //   enumerable: true,
                            //   configurable: true
                            // });

                            // For best browser support, use the following:
                            A[k] = mappedValue;
                        }
                        // d. Increase k by 1.
                        k++;
                    }

                    // 9. return A
                    return A;
                  };
                }

            // Polyfill for Array function foreach() - from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Polyfill
            // Production steps of ECMA-262, Edition 5, 15.4.4.18
            // Reference: http://es5.github.io/#x15.4.4.18
            if (!Array.prototype.forEach) {

                Array.prototype.forEach = function(callback, thisArg) {

                    var T, k;

                    if (this == null) {
                        throw new TypeError(" this is null or not defined");
                    }

                    // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
                    var O = Object(this);

                    // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
                    // 3. Let len be ToUint32(lenValue).
                    var len = O.length >>> 0;

                    // 4. If IsCallable(callback) is false, throw a TypeError exception.
                    // See: http://es5.github.com/#x9.11
                    if (typeof callback !== "function") {
                        throw new TypeError(callback + " is not a function");
                    }

                    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
                    if (arguments.length > 1) {
                        T = thisArg;
                    }

                    // 6. Let k be 0
                    k = 0;

                    // 7. Repeat, while k < len
                    while (k < len) {

                        var kValue;

                        // a. Let Pk be ToString(k).
                        //   This is implicit for LHS operands of the in operator
                        // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
                        //   This step can be combined with c
                        // c. If kPresent is true, then
                        if (k in O) {

                            // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                            kValue = O[k];

                            // ii. Call the Call internal method of callback with T as the this value and
                            // argument list containing kValue, k, and O.
                            callback.call(T, kValue, k, O);
                        }
                        // d. Increase k by 1.
                        k++;
                    }
                    // 8. return undefined
                };
            }

            // Polyfill for Object.keys()
            // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
            if (!Object.keys) {
                Object.keys = (function() {
                    "use strict";
                    var hasOwnProperty = Object.prototype.hasOwnProperty,
                        hasDontEnumBug = !({ toString: null }).propertyIsEnumerable("toString"),
                        dontEnums = [
                            "toString",
                            "toLocaleString",
                            "valueOf",
                            "hasOwnProperty",
                            "isPrototypeOf",
                            "propertyIsEnumerable",
                            "constructor"
                        ],
                        dontEnumsLength = dontEnums.length;

                    return function(obj) {
                        if (typeof obj !== "object" && (typeof obj !== "function" || obj === null)) {
                            throw new TypeError("Object.keys called on non-object");
                        }

                        var result = [], prop, i;

                        for (prop in obj) {
                            if (hasOwnProperty.call(obj, prop)) {
                              result.push(prop);
                            }
                        }

                        if (hasDontEnumBug) {
                            for (i = 0; i < dontEnumsLength; i++) {
                                if (hasOwnProperty.call(obj, dontEnums[i])) {
                                    result.push(dontEnums[i]);
                                }
                            }
                        }
                        return result;
                    };
                }());
            }

            // Polyfill for Array.indexOf
            // Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf#Polyfill
            // Production steps of ECMA-262, Edition 5, 15.4.4.14
            // Reference: http://es5.github.io/#x15.4.4.14
            if (!Array.prototype.indexOf) {
                Array.prototype.indexOf = function(searchElement, fromIndex) {

                    var k;

                    // 1. Let o be the result of calling ToObject passing
                    //    the this value as the argument.
                    if (this == null) {
                        throw new TypeError('"this" is null or not defined');
                    }

                    var o = Object(this);

                    // 2. Let lenValue be the result of calling the Get
                    //    internal method of o with the argument "length".
                    // 3. Let len be ToUint32(lenValue).
                    var len = o.length >>> 0;

                    // 4. If len is 0, return -1.
                    if (len === 0) {
                        return -1;
                    }

                    // 5. If argument fromIndex was passed let n be
                    //    ToInteger(fromIndex); else let n be 0.
                    var n = fromIndex | 0;

                    // 6. If n >= len, return -1.
                    if (n >= len) {
                        return -1;
                    }

                    // 7. If n >= 0, then Let k be n.
                    // 8. Else, n<0, Let k be len - abs(n).
                    //    If k is less than 0, then let k be 0.
                    k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

                    // 9. Repeat, while k < len
                    while (k < len) {
                        // a. Let Pk be ToString(k).
                        //   This is implicit for LHS operands of the in operator
                        // b. Let kPresent be the result of calling the
                        //    HasProperty internal method of o with argument Pk.
                        //   This step can be combined with c
                        // c. If kPresent is true, then
                        //    i.  Let elementK be the result of calling the Get
                        //        internal method of o with the argument ToString(k).
                        //   ii.  Let same be the result of applying the
                        //        Strict Equality Comparison Algorithm to
                        //        searchElement and elementK.
                        //  iii.  If same is true, return k.
                        if (k in o && o[k] === searchElement) {
                            return k;
                        }
                        k++;
                    }
                    return -1;
                };
            }
        }
    }
})()
, MetacatUI);

/* Set the polyfills */
MetacatUI.preventCompatabilityIssues();

/* Optionally set up the map */
if( MetacatUI.config.googleMapsKey ){
    var gmapsURL = "https://maps.googleapis.com/maps/api/js?v=3&key=" + MetacatUI.config.googleMapsKey;
    define("gmaps",
        ["async!" + gmapsURL],
        function() {
            return google.maps;
        });
} else {
    define("gmaps", null);
}

/* Optionally set up D3 */
if ( MetacatUI.useD3 ) {
    MetacatUI.d3URL = '../components/d3.v3.min';

} else {
    MetacatUI.d3URL = null;

}

/* Configure the app to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively
   support requirejs. */
require.config({
  baseUrl: MetacatUI.root + '/js/',
  waitSeconds: 180, //wait 3 minutes before throwing a timeout error
  map: MetacatUI.config.themeConfig? MetacatUI.config.themeConfig.themeMap : {},
  urlArgs: "v=" + MetacatUI.cacheBuster,
  paths: {
    jquery: MetacatUI.root + '/components/jquery-1.9.1.min',
    jqueryui: MetacatUI.root + '/components/jquery-ui.min',
    jqueryform: MetacatUI.root + '/components/jquery.form',
    underscore: MetacatUI.root + '/components/underscore-min',
    backbone: MetacatUI.root + '/components/backbone-min',
    bootstrap: MetacatUI.root + '/components/bootstrap.min',
    text: MetacatUI.root + '/components/require-text',
    jws: MetacatUI.root + '/components/jws-3.2.min',
    jsrasign: MetacatUI.root + '/components/jsrsasign-4.9.0.min',
    async: MetacatUI.root + '/components/async',
	nGeohash: MetacatUI.root + '/components/geohash/main',
	fancybox: MetacatUI.root + '/components/fancybox/jquery.fancybox.pack', //v. 2.1.5
    annotator: MetacatUI.root + '/components/annotator/v1.2.10/annotator-full',
    bioportal: MetacatUI.root + '/components/bioportal/jquery.ncbo.tree-2.0.2',
    clipboard: MetacatUI.root + '/components/clipboard.min',
    uuid: MetacatUI.root + '/components/uuid',
    md5: MetacatUI.root + '/components/md5',
    rdflib: MetacatUI.root + '/components/rdflib.min',
    x2js: MetacatUI.root + '/components/xml2json',
    he: MetacatUI.root + '/components/he',
	// showdown + extensions (used in the markdownView to convert markdown to html)
	showdown: MetacatUI.root + '/components/showdown/showdown.min',
	showdownHighlight: MetacatUI.root + '/components/showdown/extensions/showdown-highlight/showdown-highlight',
	highlight: MetacatUI.root + '/components/showdown/extensions/showdown-highlight/highlight.pack',
	showdownFootnotes: MetacatUI.root + '/components/showdown/extensions/showdown-footnotes',
	showdownBootstrap: MetacatUI.root + '/components/showdown/extensions/showdown-bootstrap',
	showdownDocbook: MetacatUI.root + '/components/showdown/extensions/showdown-docbook',
	showdownKatex: MetacatUI.root + '/components/showdown/extensions/showdown-katex/showdown-katex.min',
	citation: MetacatUI.root + '/components/showdown/extensions/showdown-citation/citation-0.4.0-9.min',
	showdownCitation:  MetacatUI.root + '/components/showdown/extensions/showdown-citation/showdown-citation',
	showdownImages:  MetacatUI.root + '/components/showdown/extensions/showdown-images',
	showdownXssFilter: MetacatUI.root + '/components/showdown/extensions/showdown-xss-filter/showdown-xss-filter',
	xss: MetacatUI.root + '/components/showdown/extensions/showdown-xss-filter/xss.min',
	showdownHtags: MetacatUI.root + '/components/showdown/extensions/showdown-htags',
	//Have a null fallback for our d3 components for browsers that don't support SVG
	d3: MetacatUI.d3URL,
	LineChart: ['views/LineChartView', null],
	BarChart: ['views/BarChartView', null],
	CircleBadge: ['views/CircleBadgeView', null],
	DonutChart: ['views/DonutChartView', null],
	MetricsChart: ['views/MetricsChartView', null],
  },
  shim: { /* used for libraries without native AMD support */
    underscore: {
      exports: '_',
    },
    backbone: {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    },
    bootstrap: {
    	deps: ['jquery'],
    	exports: 'Bootstrap'
    },
    annotator: {
    	exports: 'Annotator'
    },
    bioportal: {
    	exports: 'Bioportal'
    },
    jws: {
    	exports: 'JWS',
        deps: ['jsrasign'],
    },
	nGeohash: {
		exports: "geohash"
	},
	fancybox: {
		deps: ['jquery']
	},
	uuid: {
        exports: 'uuid'
    },
    rdflib: {
        exports: 'rdf'
    },
	xss: {
		exports: 'filterXSS'
	},
	citation: {
		exports: 'Cite'
	}
  }
});

MetacatUI.appModel = MetacatUI.appModel || {};
MetacatUI.appView = MetacatUI.appView || {};
MetacatUI.uiRouter = MetacatUI.uiRouter || {};
MetacatUI.appSearchResults = MetacatUI.appSearchResults || {};
MetacatUI.appSearchModel = MetacatUI.appSearchModel || {};
MetacatUI.rootDataPackage = MetacatUI.rootDataPackage || {};
MetacatUI.statsModel = MetacatUI.statsModel || {};
MetacatUI.mapModel = MetacatUI.mapModel || {};
MetacatUI.appLookupModel = MetacatUI.appLookupModel || {};
MetacatUI.nodeModel = MetacatUI.nodeModel || {};
MetacatUI.appUserModel = MetacatUI.appUserModel || {};

/* Setup the application scaffolding first  */
require(['bootstrap', 'views/AppView', 'models/AppModel'],
function(Bootstrap, AppView, AppModel) {
	'use strict';

	// initialize the application
	MetacatUI.appModel = new AppModel(MetacatUI.config);

	/* Now require the rest of the libraries for the application */
	require(['underscore', 'backbone', 'routers/router', 'collections/SolrResults', 'models/Search',
             'models/Stats', 'models/Map', 'models/LookupModel', 'models/NodeModel',
             'models/UserModel', 'models/DataONEObject', 'collections/DataPackage'
	         ],
	function(_, Backbone, UIRouter, SolrResultList, Search, Stats, MapModel, LookupModel, NodeModel, UserModel, DataONEObject, DataPackage) {
		'use strict';

		//Create all the other models and collections first
		MetacatUI.appSearchResults = new SolrResultList([], {});

		MetacatUI.appSearchModel = new Search();

		MetacatUI.statsModel = new Stats();

		MetacatUI.mapModel = (typeof customMapModelOptions == "object")? new MapModel(customMapModelOptions) : new MapModel();

		MetacatUI.appLookupModel = new LookupModel();

		MetacatUI.nodeModel = new NodeModel();

		MetacatUI.appUserModel = new UserModel();

        /* Create a general event dispatcher to enable
           communication across app components
        */
        MetacatUI.eventDispatcher = _.clone(Backbone.Events);

		//Load the App View now
		MetacatUI.appView = new AppView();

		// Initialize routing and start Backbone.history()
		(function() {
		  /**
		   * Backbone.routeNotFound
		   *
		   * Simple plugin that listens for false returns on Backbone.history.loadURL and fires an event
		   * to let the application know that no routes matched.
		   *
		   * @author STRML
		   */
		  var oldLoadUrl = Backbone.History.prototype.loadUrl;

		  _.extend(Backbone.History.prototype, {

		    /**
		     * Override loadUrl & watch return value. Trigger event if no route was matched.
		     * @return {Boolean} True if a route was matched
		     */
		    loadUrl : function(fragment) {
		    	if (!this.matchRoot()) return false;
		        fragment = this.fragment = this.getFragment(fragment);
		       var match = _.some(this.handlers, function(handler) {
		          if (handler.route.test(fragment)) {
		            handler.callback(fragment);
		            return true;
		          }
		        });

		       if(!match) this.trigger("routeNotFound");
		       return match;
		    },
		    matchRoot: function() {
		        var path = this.decodeFragment(this.location.pathname);
		        var rootPath = path.slice(0, this.root.length - 1) + '/';
		        return rootPath === this.root;
		      },
		      decodeFragment: function(fragment) {
		          return decodeURI(fragment.replace(/%25/g, '%2525'));
		        }
		  });
		}).call(this);

		//Make the router and begin the Backbone history
		//The router will figure out which view to load first based on window location
		MetacatUI.uiRouter = new UIRouter();

		//Take the protocol and origin out of the root URL when sending it to Backbone.history.
		// The root URL sent to Backbone.history should be either `/` or `/directory/...`
		var historyRoot = MetacatUI.root;

		//If there is a protocol
		if( historyRoot.indexOf("://") > -1 ){
			//Get the substring after the ``://``
			historyRoot = historyRoot.substring(historyRoot.indexOf("://") + 3);

			//If there is no `/`, this must be the root directory
			if( historyRoot.indexOf("/") == -1 )
				historyRoot = "/";
			//Otherwise get the substring after the first /
			else
				historyRoot = historyRoot.substring( historyRoot.indexOf("/") );
		}
		//If there are no colons, periods, or slashes, this is a directory name
		else if( historyRoot.indexOf(":") == -1 &&
						 historyRoot.indexOf(".") == -1 &&
						 historyRoot.indexOf("/") == -1 ){
			//So the root is a leading slash and the directory name
			historyRoot = "/" + historyRoot;
		}
		//If there is a slash, get the path name starting with the slash
		else if( historyRoot.indexOf("/") > -1 ){
			historyRoot = historyRoot.substring( historyRoot.indexOf("/") );
		}
		//All other strings are the root directory
		else{
			historyRoot = "/";
		}

		Backbone.history.start({
			pushState: true,
			root: historyRoot
		});

		$(document).on("click", "a:not([data-toggle])", function(evt) {
			// Don't hijack the event if the user had Control or Command held down
			if (evt.ctrlKey || evt.metaKey) {
				return;
			}

			var href = { prop: $(this).prop("href"), attr: $(this).attr("href") };

			// Stop if the click happened on an a w/o an href
			// This is kind of a weird edge case where. This could be removed if
			// we remove these instances from the codebase
			if (typeof href === "undefined" || typeof href.attr === "undefined" ||
					href.attr === "") {
				return;
			}

			//Don't route to URLs with the DataONE API, which are sometimes proxied
			// via Apache ProxyPass so start with the MetacatUI origin
			if( href.attr.indexOf("/cn/v2/") > 0 || href.attr.indexOf("/mn/v2/") > 0 ){
				return;
			}

			var root = location.protocol + "//" + location.host + Backbone.history.options.root;
			// Remove the MetacatUI (plus a trailing /) from the value in the 'href'
			// attribute of the clicked element so Backbone.history.navigate works.
			// Note that a RegExp was used here to anchor the .replace call to the
			// front of the string so that this code works when MetacatUI.root is "".
			var route = href.attr.replace(new RegExp("^" + MetacatUI.root + "/"), "");

			// Catch routes hrefs that start with # and don't do anything with them
			if (href.attr.indexOf("#") == 0) { return; }

			//If the URL is not a route defined in the app router, then follow the link
			//If the URL is not at the MetacatUI root, then follow the link
			if (href.prop && href.prop.slice(0, root.length) === root &&
					_.contains(MetacatUI.uiRouter.getRouteNames(), MetacatUI.uiRouter.getRouteName(route))) {
				evt.preventDefault();
				Backbone.history.navigate(route, true);
			}
		});
	});
});
