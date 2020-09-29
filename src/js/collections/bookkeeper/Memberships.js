"use strict";

define(["jquery", "underscore", "backbone", "models/bookkeeper/Membership", "collections/bookkeeper/Usages"],
  function($, _, Backbone, Membership, Usages) {

  /**
   * @class Memberships
   * @classdesc A Memberships collection is a collection of {@link Membership} models
   * that represent one or more DataONE service Memberships, as part of the DataONE
   * Bookkeeper service.
   * See https://github.com/DataONEorg/bookkeeper for documentation on the
   * DataONE Bookkeeper service and data model.
   */
  var Memberships = Backbone.Collection.extend(
    /** @lends Memberships.prototype */ {

    /**
    * The name of this Collection type
    * @type {string}
    */
    type: "Memberships",

    /**
    * The class/model that is contained in this collection.
    * @type {Backbone.Model}
    */
    model: Membership,

    /**
    * The Usages collection associated with these Memberships, which will be divided among the
    * Membership models they are associated with.
    * @type {Usages}
    */
    usagesCollection: null,

    /**
    * If true, this collection is in the process of being fetched
    * @type {boolean}
    */
    fetching: false,

    /**
    * A list of query parameters that are supported by the Bookkeeper Memberships API. These
    * query parameters can be passed to {@link Memberships#fetch} in the `options` object, and they
    * will be used during the fetch.
    * @type {string[]}
    */
    queryParams: ["requestor", "subscriber"],

    /**
    * Constructs a URL string for fetching this collection and returns it
    * @param {Object} [options]
    * @property {string} options.requestor  The subject of the user that is requesting the Memberships list.
    *                                       This is usually the same as `subscriber`, but can be different to
    *                                       retrieve Memberships at a lower authorization level.
    * @property {string} options.subscriber  The user or group subject associated with these Memberships
    * @returns {string} The URL string
    */
    url: function(options){

      var url = "";

      //Use the attributes from the options object for the URL, if it is passed to this function
      if( typeof options == "object" ){

        _.each( this.queryParams, function(name){
          if( typeof options[name] !== "undefined"){
            if( url.length == 0 ){
              url += "?";
            }
            else{
              url += "&";
            }

            url += name + "=" + encodeURIComponent(options[name]);
          }
        });

      }

      //Prepend the Bookkeeper Memberships URL to the url query parameters string
      url = MetacatUI.appModel.get("bookkeeperMembershipsUrl") + url;

      return url;

    },

    /**
    * Fetches a list of Memberships from the DataONE Bookkeeper service, parses them, and
    * stores them on this collection.
    * @param {Object} [options]
    * @property {string} options.requestor  The subject of the user that is requesting the Memberships list.
    *                                       This is usually the same as `subscriber`, but can be different to
    *                                       retrieve Memberships at a lower authorization level.
    * @property {string} options.subscriber  The user or group subject associated with these Memberships
    */
    fetch: function(options){

      //Mark that this Collection is being fetched
      this.fetching = true;

      var fetchOptions = {
        url: this.url(options),
        error: function(memberships, xhr){
          if( xhr.status == 404 ){
            memberships.trigger("notFound");
          }
        }
      }

      fetchOptions = Object.assign(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());

      //Fetch the portal Usages for the logged-in User, as well
      var usages = new Usages();
      this.listenToOnce(usages, "sync", this.parseUsages);
      usages.fetching = true;
      usages.fetch({
        quotaType: "portal",
        subject: MetacatUI.appUserModel.get("username")
      });
      this.usagesCollection = usages;

      //Call Backbone.Collection.fetch to retrieve the info
      return Backbone.Collection.prototype.fetch.call(this, fetchOptions);

    },

    /**
    * Parses the fetch() of this collection. Bookkeeper returns JSON already, so there
    * isn't much parsing to do.
    * @returns {JSON} The collection data in JSON form
    */
    parse: function(response){
      //Mark that this Collection is done being fetched
      this.fetching = false;

      return response.subscriptions;
    },

    /**
    * Organizes the Usage models by Membership so that each Membership model in this collection
    * has a reference to a Usages collection that contains the Usages for that Membership.
    */
    parseUsages: function(){

      //If this Memberships collection is still being fetched, then wait until it is
      // finished and parse the Usages
      if( this.fetching ){
        this.once("sync", this.parseUsages);
        return;
      }
      else{

        this.usagesCollection.each(function(usage){

          this.each(function(membership){
            var matchingQuota = membership.get("quotas").findWhere({ id: usage.get("quotaId") });

            if( matchingQuota && matchingQuota.type == "Quota" ){
              //Add the Usage to the Quota
              matchingQuota.addUsage(usage);
            }

          });

        }, this);

        this.usagesCollection.fetching = false;

      }

    }

  });

  return Memberships;
});
