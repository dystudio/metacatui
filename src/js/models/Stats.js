/*global define */
define(['jquery', 'underscore', 'backbone', 'models/LogsSearch'],
	function($, _, Backbone, LogsSearch) {
	'use strict';

	// Statistics Model
	// ------------------
	var Stats = Backbone.Model.extend({
		// This model contains all of the statistics in a user's or query's profile
		defaults: {
			query: "*:*", //Show everything

			metadataCount: 0,
			dataCount: 0,
			totalCount: 0,
			metadataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]
			dataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]

			firstUpload: 0,
			totalUploads: 0, //total data and metadata objects uploaded, including now obsoleted objects
			metadataUploads: null,
			dataUploads: null,
			metadataUploadDates: null,
			dataUploadDates: null,

			//Number of updates to content for each time period
			firstUpdate: 0,
			dataUpdateDates: null,
			metadataUpdateDates: null,

			downloads: 0,
			metadataDownloads: null,
			dataDownloads: null,
			metadataDownloadDates: null,
			dataDownloadDates: null,

			firstBeginDate: 0,
			temporalCoverage: 0,
			coverageYears: 0,

			// complex objects like this
			// {mdq_composite_d: {"min":0.25,"max":1.0,"count":11,"missing":0,"sum":6.682560903149138,"sumOfSquares":4.8545478685001076,"mean":0.6075055366499217,"stddev":0.2819317507548068}}
			mdqStats: {},
            
            analyticsQuery: {"groupings" : {  
                    "scores" : {
                        "expressions" : {
                            "min_score" : "min(scoreOverall)",
                            "pctl_25"   : "percentile(25.0, scoreOverall)",
                            "median"    : "median(scoreOverall)",
                            "pctl_75"   : "percentile(75.0, scoreOverall)",
                            "max_score" : "max(scoreOverall)",
                            "count"     : "count(scoreOverall)"
                          },
                          "facets" : {
                              "scoresByDateRange" : {
                               "type" : "range",
                                "field" : "dateUploaded",
                                "start" : "2016-01-01T00:00:00.000Z",
                                "end" : "2020-01-01T00:00:00.000Z",
                                "gaps" : [ "+1YEAR" ],
                                "hardend" : true,
                                "include" : [
                                    "lower",
                                    "upper"
                                ],
                                "others" : [ "none" ]
                            }
                        }
                    }
                }
            },

			supportDownloads: (MetacatUI.appModel.get("nodeId") && MetacatUI.appModel.get("d1LogServiceUrl"))
		},

		//Some dated used for query creation
		firstPossibleUpload: "2000-01-01T00:00:00Z", //The first possible date that an object could be uploaded (based on DataONE dates)
		firstPossibleDataONEDownload: "2012-07-01T00:00:00Z", //The first possible download date from the DataONE CN
		firstPossibleDataONEDate: "2012-07-01T00:00:00Z", //The first possible download date from the DataONE CN
		firstPossibleDate: "1800-01-01T00:00:00Z",   //The first possible date that data could have been collected in (based on DataONE dates)

		initialize: function(){
			//Add a function to parse ISO date strings for IE8 and other older browsers
			(function(){
			    var D= new Date('2011-06-02T09:34:29+02:00');
			    if(!D || +D!== 1307000069000){
			        Date.fromISO= function(s){
			            var day, tz,
			            rx=/^(\d{4}\-\d\d\-\d\d([tT ][\d:\.]*)?)([zZ]|([+\-])(\d\d):(\d\d))?$/,
			            p= rx.exec(s) || [];
			            if(p[1]){
			                day= p[1].split(/\D/);
			                for(var i= 0, L= day.length; i<L; i++){
			                    day[i]= parseInt(day[i], 10) || 0;
			                };
			                day[1]-= 1;
			                day= new Date(Date.UTC.apply(Date, day));
			                if(!day.getDate()) return NaN;
			                if(p[5]){
			                    tz= (parseInt(p[5], 10)*60);
			                    if(p[6]) tz+= parseInt(p[6], 10);
			                    if(p[4]== '+') tz*= -1;
			                    if(tz) day.setUTCMinutes(day.getUTCMinutes()+ tz);
			                }
			                return day;
			            }
			            return NaN;
			        }
			    }
			    else{
			        Date.fromISO= function(s){
			            return new Date(s);
			        }
			    }
			})();

			//this.on("change:dataDownloads",     this.sumDownloads);
			//this.on("change:metadataDownloads", this.sumDownloads);
		},

		//This function serves as a shorthand way to get all of the statistics stored in the model
		getAll: function(){
			//Listen for our responses back from the server before we send requests that require info from the response
			this.listenToOnce(this, 'change:firstBeginDate', this.getLastEndDate);
			this.listenToOnce(this, 'change:lastEndDate', this.getCollectionYearFacets);
			this.listenToOnce(this, 'change:dataCount', this.getDataFormatIDs);
			this.listenToOnce(this, 'change:metadataCount', this.getMetadataFormatIDs);
			this.listenToOnce(this, 'change:firstUpload', this.getUpdateDates);


			this.getFirstBeginDate();
			this.getFirstUpload();

			this.getFormatTypes();

			this.getDownloadDates();

			this.getMdqStats();
			//this.getDataDownloadDates();
			//this.getMetadataDownloadDates();
		},

		// Send a Solr query to get the earliest beginDate, latest endDate, and facets of data collection years
		getFirstBeginDate: function(){
			var model = this;

			var now = new Date();

			//Get the earliest temporal data coverage year
			var query = this.get('query') +
						"+beginDate:[" + this.firstPossibleDate + "%20TO%20" + now.toISOString() + "]" //Use date filter to weed out badly formatted data
						"+-obsoletedBy:*";

			var otherParams = "&rows=1" +
							  "&fl=beginDate" +
							  "&sort=beginDate+asc" +
							  "&wt=json";

			//Save this
			this.getFirstBeginDateQuery = query;

			//Query for the earliest beginDate
			var requestSettings = {
				url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query + otherParams,
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {

					//Is this the latest query?
					if(decodeURIComponent(model.getFirstBeginDateQuery).replace(/\+/g, " ") != data.responseHeader.params.q)
						return;

					if(!data.response.numFound){
						//There were no begin dates found
						model.set('totalBeginDates', 0);

						var endDateQuery = query.replace(/beginDate/g, "endDate");

						//Find the earliest endDate if there are no beginDates
						var requestSettings = {
							url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + endDateQuery + otherParams,
							type: "GET",
							success: function(endDateData, textStatus, xhr) {
								//If not endDates or beginDates are found, there is no temporal data in the index, so save falsey values
								if(!endDateData.response.numFound){
									model.set('firstBeginDate', null);
									model.set('lastEndDate', null);
								}
								else{
									model.set('firstBeginDate', new Date.fromISO(endDateData.response.docs[0].endDate));
								}
							}
						}
						$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
					}
					else{
						// Save the earliest beginDate and total found in our model
						model.set('firstBeginDate', new Date.fromISO(data.response.docs[0].beginDate));
						model.set('totalBeginDates', data.response.numFound);

						model.trigger("change:firstBeginDate");
						model.trigger("change:totalBeginDates");
					}
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		getLastEndDate: function(){
			var model = this;

			var now = new Date();

			//Get the latest temporal data coverage year
			var query = this.get('query') +
						"+endDate:[" + this.firstPossibleDate + "%20TO%20" + now.toISOString() + "]" + //Use date filter to weed out badly formatted data
						"+-obsoletedBy:*";
			var otherParams = "&rows=1" +
							  "&fl=endDate" +
							  "&sort=endDate+desc" +
							  "&wt=json";

			//Save this query so we know what the most recent one is
			this.getLastEndDateQuery = query;

			//Query for the latest endDate
			var requestSettings = {
				url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query + otherParams,
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {
					if(typeof data == "string") data = JSON.parse(data);

					//Is this the latest query?
					if(decodeURIComponent(model.getLastEndDateQuery).replace(/\+/g, " ") != data.responseHeader.params.q)
						return;

					if(!data.response.numFound){
						//Save some falsey values if none are found
						model.set('lastEndDate', null);
					}
					else{
						// Save the earliest beginDate and total found in our model - but do not accept a year greater than this current year
						var now = new Date();
						if(new Date.fromISO(data.response.docs[0].endDate).getUTCFullYear() > now.getUTCFullYear()) model.set('lastEndDate', now);
						else model.set('lastEndDate', new Date.fromISO(data.response.docs[0].endDate));

						model.trigger("change:lastEndDate");
					}
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		/**
		** getFormatTypes will send three Solr queries to get the formatTypes and formatID statistics and will update the  model
		**/
		getFormatTypes: function(){
			var model = this;

			//Build the query to get the format types
			var query = this.get('query') +
						"+%28formatType:METADATA%20OR%20formatType:DATA%29+-obsoletedBy:*";
			var otherParams = "&rows=2" +
						 	  "&group=true" +
							  "&group.field=formatType" +
							  "&group.limit=0" +
							  "&stats=true" +
							  "&stats.field=size" +
							  "&sort=formatType%20desc" +
							  "&wt=json";

			//Run the query
			var requestSettings = {
				url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query + otherParams,
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {

					var formats = data.grouped.formatType.groups;

					if(formats.length == 1){	//Only one format type was found
						if(formats[0].groupValue == "METADATA"){ //That one format type is metadata
							model.set('dataCount', 0);
							model.trigger("change:dataCount");
							model.set('metadataCount', formats[0].doclist.numFound);
							model.set('dataFormatIDs', ["", 0]);
						}else{
							model.set('dataCount', formats[0].doclist.numFound);
							model.set('metadataCount', 0);
							model.trigger("change:metadataCount");
							model.set('metadataFormatIDs', ["", 0]);
						}
					}
					//If no data or metadata objects were found, draw blank charts
					else if(formats.length == 0){

						//Store falsey data
						model.set('dataCount', 0);
						model.trigger("change:dataCount");

						model.set("totalCount", 0);
						model.trigger("change:totalCount");

						model.set('metadataCount', 0);
						model.trigger("change:metadataCount");

						model.set('metadataFormatIDs', ["", 0]);
						model.set('dataFormatIDs', ["", 0]);

						return;
					}
					else{
						//Extract the format types (because of filtering and sorting they will always return in this order)
						model.set('metadataCount', formats[0].doclist.numFound);
						model.set('dataCount', formats[1].doclist.numFound);
					}

					//Get the total size of all the files in the index
					var totalSize = data.stats.stats_fields.size.sum;
					model.set("totalSize", totalSize);
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		getDataFormatIDs: function(){
			var model = this;

			var query = "q=" + this.get('query') +
			"+formatType:DATA+-obsoletedBy:*" +
			"&facet=true" +
			"&facet.field=formatId" +
			"&facet.limit=-1" +
			"&facet.mincount=1" +
			"&rows=0" +
			"&wt=json";

			if(this.get('dataCount') > 0){
				//Now get facet counts of the data format ID's
				var requestSettings = {
					url: MetacatUI.appModel.get('queryServiceUrl') + query,
					type: "GET",
					dataType: "json",
					success: function(data, textStatus, xhr) {
						model.set('dataFormatIDs', data.facet_counts.facet_fields.formatId);
					}
				}

				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
			}
		},

		getMetadataFormatIDs: function(){
			var model = this;

			var query = "q=" + this.get('query') +
						"+formatType:METADATA+-obsoletedBy:*" +
						"&facet=true" +
						"&facet.field=formatId" +
						"&facet.limit=-1" +
						"&facet.mincount=1" +
						"&rows=0" +
						"&wt=json";

			if(this.get('metadataCount') > 0){

				//Now get facet counts of the metadata format ID's
				var requestSettings = {
					url: MetacatUI.appModel.get('queryServiceUrl') + query,
					type: "GET",
					dataType: "json",
					success: function(data, textStatus, xhr) {
						model.set('metadataFormatIDs', data.facet_counts.facet_fields.formatId);
					}
				}

				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
			}
		},

		/*
		 * getUpdateDates will get the number of newest-version science metadata and data
		 * objects uploaded in each month
		 */
		getUpdateDates: function(){

			//If the node model hasn't been retrieved yet, then wait - because we need to know
			//if the first update date should be based on the DataONE time frame (started in 2012)
			//or a metacat timeframe (as early as 2001)
			if( !MetacatUI.nodeModel.get("coordinators").length ){
				this.listenToOnce(MetacatUI.nodeModel, "change:coordinators", this.getUpdateDates);
				return;
			}

			// If there has never been an update, there are no dates to get
			if( !this.get("firstUpload") ){
				this.set('firstUpdate', null);

				this.set("metadataUpdateDates", []);
				this.set("dataUpdateDates", []);

				return;
			}

			var model = this;

			var now = new Date();

			var dataQuery =  "q=" + model.get('query') +
			  "+-obsoletedBy:*+formatType:DATA";

			var metadataQuery =  "q=" + model.get('query') +
			  "+-obsoletedBy:*+formatType:METADATA";

			var firstPossibleUpdate = MetacatUI.nodeModel.isCN(MetacatUI.nodeModel.get("currentMemberNode"))?
					this.firstPossibleDataONEDate : model.get("firstUpload");

			var facets =  "&rows=1" +
						  "&sort=dateUploaded+asc" +
						  "&facet=true" +
						  "&facet.missing=true" + //Include months that have 0 uploads
						  "&facet.limit=-1" +
						  "&facet.range=dateUploaded" +
						  "&facet.range.start=" + firstPossibleUpdate +
						  "&facet.range.end=" + now.toISOString() +
						  "&facet.range.gap=%2B1MONTH" +
						  "&wt=json";

			//Run the query
			var requestSettings = {
				url: MetacatUI.appModel.get('queryServiceUrl') + metadataQuery + facets,
				dataType: "json",
				type: "GET",
				success: function(data, textStatus, xhr) {

					if( !data.response.numFound ){
						model.set('firstUpdate', null);

						model.set("metadataUpdateDates", []);

					}
					else{
						// Save the earliest dateUploaded and total found in our model
						model.set('firstUpdate', data.response.docs[0].dateUploaded);

						//Remove all the empty facet counts at the beginning of the array
						var updateDates = data.facet_counts.facet_ranges.dateUploaded.counts;

						while(updateDates[1] == 0){

							updateDates.splice(0, 2);

						}

						//Save the dateUploaded facets for metadata objects
						model.set("metadataUpdateDates", updateDates);
					}

					var requestSettings = {
						url: MetacatUI.appModel.get('queryServiceUrl') + dataQuery + facets,
						type: 'GET',
						dataType: "json",
						success: function(data, textStatus, xhr) {
							if( !data.response.numFound ){
								model.set("dataUpdateDates", []);
							}
							else{

								// Save the earliest dateUploaded and total found in our model
								if(data.response.docs[0].dateUploaded < model.set("firstUpdate"))
									model.set('firstUpdate', data.response.docs[0].dateUploaded);

								//Remove all the empty facet counts at the beginning of the array
								var updateDates = data.facet_counts.facet_ranges.dateUploaded.counts;

								while(updateDates[1] == 0){

									updateDates.splice(0, 2);

								}

								//Save the dateUploaded facets for data objects
								model.set("dataUpdateDates", updateDates);
							}
						}
					}

					$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

		},

				/*
		 * Gets the earliest dateUploaded from the solr index
		 */
		getFirstUpload: function(){
			//If the node model hasn't been retrieved yet, then wait - because we need to know
			//if the first update date should be based on the DataONE time frame (started in 2012)
			//or a metacat timeframe (as early as 2001)
			if( !MetacatUI.nodeModel.get("coordinators").length ){
				this.listenToOnce(MetacatUI.nodeModel, "change:coordinators", this.getFirstUpload);
				return;
			}

			var now = new Date(),
				model = this,
				firstPossibleUpload = MetacatUI.nodeModel.isCN(MetacatUI.appModel.get("nodeId") || MetacatUI.nodeModel.get("currentMemberNode"))?
						this.firstPossibleDataONEDate : this.firstPossibleUpload;

			//Get the earliest upload date
			var query =  "q=" + this.get('query') +
							"+formatType:(METADATA OR DATA)" + //Weeds out resource maps and annotations
							"+dateUploaded:[" + firstPossibleUpload + "%20TO%20" + now.toISOString() + "]" + //Weeds out badly formatted dates
							"+-obsoletes:*"+    //Only count one version of a revision chain
							"&fl=dateUploaded" +
							"&rows=1" +
							"&sort=dateUploaded+asc" +
							"&wt=json";

			//Run the query
			var requestSettings = {
				url: MetacatUI.appModel.get('queryServiceUrl') + query,
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {
					if(!data.response.numFound){
						//Save some falsey values if none are found
						model.set('totalUploads', 0);
						model.trigger("change:totalUploads");

						model.set('firstUpload', null);

						model.set("dataUploads", 0);
						model.set("metadataUploads", 0);
						model.set('metadataUploadDates', []);
						model.set('dataUploadDates', []);
					}
					else{
						// Save the earliest dateUploaded and total found in our model
						model.set('firstUpload', data.response.docs[0].dateUploaded);
						model.set('totalUploads', data.response.numFound);

						//model.getUploadDates();
					}
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

		},

		/**
		 * getUploads will get the files uploaded statistics
		 */
		getUploads: function() {

			if( !this.get("firstUpload") ){
				this.set('totalUploads', 0);
				this.trigger("change:totalUploads");

				return;
			}

			var model = this;

			var now = new Date();

			//Get the earliest upload date
			var query =  "q=" + this.get('query') +
								"+formatType:(METADATA OR DATA)" + //Weeds out resource maps and annotations
								"+dateUploaded:[" + this.firstPossibleUpload + "%20TO%20" + now.toISOString() + "]" + //Weeds out badly formatted dates
								"+-obsoletes:*"+    //Only count one version of a revision chain
								"&fl=dateUploaded" +
								"&rows=1" +
								"&sort=dateUploaded+asc" +
								"&wt=json";

			//Run the query
			var requestSettings = {
				url: MetacatUI.appModel.get('queryServiceUrl') + query,
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {

					if(!data.response.numFound){
							//Save some falsey values if none are found
							model.set('totalUploads', 0);
							model.trigger("change:totalUploads");
							model.set('firstUpload', null);
							model.set("dataUploads", 0);
							model.set("metadataUploads", 0);
							model.set('metadataUploadDates', []);
							model.set('dataUploadDates', []);

						}
						else{
							// Save the earliest dateUploaded and total found in our model
							model.set('firstUpload', data.response.docs[0].dateUploaded);
							model.set('totalUploads', data.response.numFound);

							var dataQuery =  "q=" + model.get('query') +
							  "+-obsoletes:*+formatType:DATA";

							var metadataQuery =  "q=" + model.get('query') +
							  "+-obsoletes:*+formatType:METADATA";

							var facets =  "&rows=0" +
										  "&facet=true" +
										  "&facet.missing=true" + //Include months that have 0 uploads
										  "&facet.limit=-1" +
										  "&facet.range=dateUploaded" +
										  "&facet.range.start=" + model.get('firstUpload') +
										  "&facet.range.end=" + now.toISOString() +
										  "&facet.range.gap=%2B1MONTH" +
										  "&wt=json";

							//Run the query
							var requestSettings = {
								url: MetacatUI.appModel.get('queryServiceUrl') + metadataQuery+facets,
								dataType: "json",
								type: "GET",
								success: function(data, textStatus, xhr) {
									model.set("metadataUploads", data.response.numFound);
									model.set("metadataUploadDates", data.facet_counts.facet_ranges.dateUploaded.counts);

									var requestSettings = {
										url: MetacatUI.appModel.get('queryServiceUrl') + dataQuery+facets,
										type: 'GET',
										dataType: "json",
										success: function(data, textStatus, xhr) {
											model.set("dataUploads", data.response.numFound);
											model.set("dataUploadDates", data.facet_counts.facet_ranges.dateUploaded.counts);
										}
									}

									$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
								}
							}

							$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
						}
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		/* getTemporalCoverage
		 * Get the temporal coverage of this query/user from Solr
		 */
		getCollectionYearFacets: function(){
			var model = this;

			//How many years back should we look for temporal coverage?
			var lastYear =  this.get('lastEndDate') ? this.get('lastEndDate').getUTCFullYear() : new Date().getUTCFullYear(),
				firstYear = this.get('firstBeginDate')? this.get('firstBeginDate').getUTCFullYear() : new Date().getUTCFullYear(),
				totalYears = lastYear - firstYear,
				today = new Date().getUTCFullYear(),
				now   = new Date(),
				yearsFromToday = { fromBeginning: today - firstYear,
								   fromEnd: today - lastYear
								  };

			//Determine our year bin size so that no more than 10 facet.queries are being sent at a time
			var binSize = 1;

			if((totalYears > 10) && (totalYears <= 20)){
				binSize = 2;
			}
			else if((totalYears > 20) && (totalYears <= 50)){
				binSize = 5;
			}
			else if((totalYears > 50) && (totalYears <= 100)){
				binSize = 10;
			}
			else if(totalYears > 100){
				binSize = 25;
			}

			//Construct our facet.queries for the beginDate and endDates, starting with all years before this current year
			var fullFacetQuery = "",
				key = "";

			for(var yearsAgo = yearsFromToday.fromBeginning; yearsAgo >= yearsFromToday.fromEnd; yearsAgo -= binSize){
				// The query logic here is: If the beginnning year is anytime before or during the last year of the bin AND the ending year is anytime after or during the first year of the bin, it counts.
				if(binSize == 1){
					//Querying for just the current year needs to be treated a bit differently and won't be caught in our for loop
					if((yearsAgo == 0) && (lastYear == today)){
						var oneYearFromNow = new Date();
						oneYearFromNow.setFullYear( oneYearFromNow.getFullYear() + 1 );

						var now = new Date();

						fullFacetQuery += "&facet.query={!key=" + lastYear + "}(beginDate:[*%20TO%20" + oneYearFromNow.toISOString() + "/YEAR]%20endDate:[" + now.toISOString() + "/YEAR%20TO%20*])";
					}
					else{
						key = today - yearsAgo;

						var beginDateLimit = new Date();
						beginDateLimit.setFullYear( beginDateLimit.getFullYear() - (yearsAgo-1) );

						var endDateLimit = new Date();
						endDateLimit.setFullYear( endDateLimit.getFullYear() - yearsAgo );

						fullFacetQuery += "&facet.query={!key=" + key + "}(beginDate:[*%20TO%20" + beginDateLimit.toISOString() + "/YEAR]%20endDate:[" + endDateLimit.toISOString() + "/YEAR%20TO%20*])";
					}
				}
				else if (yearsAgo <= binSize){
					key = (today - yearsAgo) + "-" + lastYear;

					var beginDateLimit = new Date();
					beginDateLimit.setFullYear( beginDateLimit.getFullYear() - yearsFromToday.fromEnd );

					var endDateLimit = new Date();
					endDateLimit.setFullYear( endDateLimit.getFullYear() - yearsAgo );

					fullFacetQuery += "&facet.query={!key=" + key + "}(beginDate:[*%20TO%20" + beginDateLimit.toISOString() +"/YEAR]%20endDate:[" + endDateLimit.toISOString() + "/YEAR%20TO%20*])";
				}
				else{
					key = (today - yearsAgo) + "-" + (today - yearsAgo + binSize-1);

					var beginDateLimit = new Date();
					beginDateLimit.setFullYear( beginDateLimit.getFullYear() - (yearsAgo - binSize-1) );

					var endDateLimit = new Date();
					endDateLimit.setFullYear( endDateLimit.getFullYear() - yearsAgo );

					fullFacetQuery += "&facet.query={!key=" + key + "}(beginDate:[*%20TO%20" + beginDateLimit.toISOString() + "/YEAR]%20endDate:[" + endDateLimit.toISOString() + "/YEAR%20TO%20*])";
				}
			}

			var now = new Date();

			//The full query
			var query = "q=" + this.get('query') +
			  "+beginDate:[" + this.firstPossibleDate + "%20TO%20" + now.toISOString() + "]" + //Use date filter to weed out badly formatted data
			  "+-obsoletedBy:*" +
			  "&rows=0" +
			  "&facet=true" +
			  "&facet.limit=30000" + //Put some reasonable limit here so we don't wait forever for this query
			  "&facet.missing=true" + //We want to retrieve years with 0 results
			  fullFacetQuery +
			  "&wt=json";

			var requestSettings = {
				url: MetacatUI.appModel.get('queryServiceUrl') + query,
				dataType: "json",
				success: function(data, textStatus, xhr) {
					model.set('temporalCoverage', data.facet_counts.facet_queries);

					/* ---Save this logic in case we want total coverage years later on---
					// Get the total number of years with coverage by counting the number of indices with a value
					// This method isn't perfect because summing by the bin doesn't guarantee each year in that bin is populated
					var keys = Object.keys(data.facet_counts.facet_queries),
						coverageYears = 0,
						remainder = totalYears%binSize;

					for(var i=0; i<keys.length; i++){
						if((i == keys.length-1) && data.facet_counts.facet_queries[keys[i]]){
							coverageYears += remainder;
						}
						else if(data.facet_counts.facet_queries[keys[i]]){
							coverageYears += binSize;
						}
					}

					//If our bins are more than one year, we need to subtract one bin from our total since we are actually conting the number of years BETWEEN bins (i.e. count one less)
					if(binSize > 1){
						coverageYears -= binSize;
					}

					statsModel.set('coverageYears',  coverageYears); */
				}

			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		/*
		 * The Downloads query can be customized only by: filtering by a certain MN or filtering by a rightsHolder
		 */

		getDataDownloadDates: function(){
			if(!MetacatUI.appModel.get("d1LogServiceUrl")){
				this.set("downloads", 0);
				this.trigger("change:downloads");
				return;
			}

			var model = this;

			var logSearch = new LogsSearch();
			logSearch.set("event", "read");
			logSearch.set("formatType", "DATA");
			logSearch.set("facetRanges", ["dateLogged"]);

			var searchModel = this.get("searchModel");
			if(searchModel && searchModel.get("dataSource")){
				logSearch.set("nodeId", searchModel.get("dataSource"))
			}
			if(searchModel && searchModel.get("username")){
				logSearch.set("username", searchModel.get("username"));
			}

			var requestSettings = {
				url: MetacatUI.appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr){
					var counts = data.facet_counts.facet_ranges.dateLogged.counts;
					model.set("dataDownloads", data.response.numFound);
					model.set("dataDownloadDates", counts);

					if(data.response.numFound == 0) model.trigger("change:dataDownloads");
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		getMetadataDownloadDates: function(){
			if(!MetacatUI.appModel.get("d1LogServiceUrl")){
				this.set("downloads", 0);
				this.trigger("change:downloads");

				return;
			}

			var model = this;

			var logSearch = new LogsSearch();
			logSearch.set("event", "read");
			logSearch.set("formatType", "METADATA");
			logSearch.set("facetRanges", ["dateLogged"]);

			var searchModel = this.get("searchModel");
			if(searchModel && searchModel.get("dataSource")){
				logSearch.set("nodeId", searchModel.get("dataSource"))
			}
			if(searchModel && searchModel.get("username")){
				logSearch.set("username", searchModel.get("username"));
			}

			var requestSettings = {
				url: MetacatUI.appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr){
					var counts = data.facet_counts.facet_ranges.dateLogged.counts;

					model.set("metadataDownloads", data.response.numFound);
					model.set("metadataDownloadDates", counts);

					if(data.response.numFound == 0) model.trigger("change:metadataDownloads");
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		getDownloadDates: function(){
			if(!MetacatUI.appModel.get("d1LogServiceUrl")){
				this.set("downloads", 0);
				this.trigger("change:downloads");
				return;
			}

			var model = this;

			var logSearch = new LogsSearch();
			logSearch.set("event", "read");
			logSearch.set("formatType", ["METADATA", "DATA"]);
			logSearch.set("facetRanges", ["dateLogged"]);
			logSearch.set("facets", ["formatType"]);

			var today = new Date();
			today.setDate(today.getUTCDay() + 1);
			today.setHours(0);
			today.setMinutes(0);
			today.setSeconds(0);
			today.setMilliseconds(0);

			logSearch.set("facetRangeStart", this.firstPossibleDataONEDownload);
			logSearch.set("facetRangeEnd", today.toISOString());

			var searchModel = this.get("searchModel");
			if(searchModel && searchModel.get("dataSource")){
				logSearch.set("nodeId", searchModel.get("dataSource"))
			}
			if(searchModel && searchModel.get("username")){
				logSearch.set("username", searchModel.get("username"));
			}

			var requestSettings = {
				url: MetacatUI.appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr){
					var counts = data.facet_counts.facet_ranges.dateLogged.counts;

					var m_index = _.indexOf(data.facet_counts.facet_fields.formatType, "METADATA");
					if(m_index > -1)
						model.set("metadataDownloads", data.facet_counts.facet_fields.formatType[m_index+1]);
					else
						model.set("metadataDownloads", 0);

					var d_index = _.indexOf(data.facet_counts.facet_fields.formatType, "DATA");
					if(d_index > -1)
						model.set("dataDownloads", data.facet_counts.facet_fields.formatType[d_index+1]);
					else
						model.set("dataDownloads", 0);

					if(data.facet_counts.facet_fields.formatType[m_index+1] == 0) model.trigger("change:metadataDownloads");
					if( data.facet_counts.facet_fields.formatType[d_index+1] == 0) model.trigger("change:dataDownloads");


					model.set("downloads", data.response.numFound);
					if(data.response.numFound == 0) model.trigger("change:downloads");

					model.set("downloadDates", counts);
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		sumDownloads: function(){
			if((this.get("dataDownloads") == null) || (this.get("metadataDownloads") == null)) return;

			this.set("downloads", this.get("dataDownloads") + this.get("metadataDownloads"));

			if(this.get("downloads") == 0) this.trigger("change:downloads");
		},

		/**
		** getMdqStats will query SOLR for MDQ stats and will update the model accordingly
		**/
		getMdqStats: function(){
            // If the metadata quality Solr server is not defined, exit
            if(!MetacatUI.appModel.get("mdqQueryServiceUrl")){
                return;
            }
            
            var userType = null;
            var userName = null;
            if(MetacatUI.appView.userView) {
                userType = MetacatUI.appView.userView.model.get("type");
                userName = MetacatUI.appView.userView.model.get("username");
            }
            
            var suiteId;
            var nodeType;
            var query;
            // Check if this is a profile for a node, running on the CN
            if(userType != null && userType == 'node'){
                // Running profile view on CN, retrieve stats for the
                // node that was entered as a route 
                var suites = MetacatUI.appModel.get("suiteIdsByNode");
                suiteId = suites[userName];
                nodeId = 'urn:node:' + userName;
                nodeType = 'mn'
                query = MetacatUI.appModel.get('mdqQueryServiceUrl') + '/select?q=suiteId:%22' + suiteId + '%22' +'datasource:%22' + nodeId + '%22';
            } else {
                // TODO: check if this is a regular user or group
                // If not a user, then we are querying for the entine MN or CN
                // If we are querying from a CN, then don't include the 'datasource' as we want info for the entire network.
                suiteId = MetacatUI.appModel.get("suiteIds")[0];
                var nodeId = MetacatUI.nodeModel.get("currentMemberNode");
                var thisNode = MetacatUI.nodeModel.isCN(nodeId);
                var nodeType = 'mn';
                if(thisNode) {
                    nodeType=thisNode.type
                }
                if(nodeType === 'cn') {
                    var query = MetacatUI.appModel.get('mdqQueryServiceUrl') + '/select?q=suiteId:%22' + suiteId + '%22';
                } else  {
                    var query = MetacatUI.appModel.get('mdqQueryServiceUrl') + '/select?q=suiteId:%22' + suiteId + '%22' +'datasource:%22' + nodeId + '%22';
                }
            }
            
            // The suite was not determined, so trigger the drawing of the view anyway
            // and let the view decide what to do.
            if (typeof suiteId == "undefined") {
                this.set("mdqStats", null);
                return;
            }

			var model = this;
            var analyticsQuery = model.get("analyticsQuery");
            //analyticsQuery.groupings.scores.facets.scoresByDateRange.start = this.firstPossibleUpload;
            analyticsQuery.groupings.scores.facets.scoresByDateRange.start = "2012-01-01T00:00:00Z",
            analyticsQuery.groupings.scores.facets.scoresByDateRange.end = 'NOW';
            
			//Build the query to get the MDQ stats

			var otherParams = "&rows=0" + "&wt=json" + "&q.op=AND";
            console.debug("mdq query: " + query + otherParams);

			//Run the query for stats
			var requestSettings = {
				url: query + otherParams,
				type: "POST",
                data: {"analytics" : JSON.stringify(analyticsQuery)},
                xhrFields: { withCredentials: false },
				success: function(data, textStatus, xhr) {
                    var result = JSON.parse(data);
                    var mdqStats = model.processMdqStats(result.analytics_response.groupings);
					// Set the pertinent information in the model
					model.set('mdqStats', mdqStats);
				},
                error: function (what, jqXhr, options) {
                  console.debug("error fetching Solr analytics report.");
				}
			};

			$.ajax(requestSettings);
		},

		/**
        ** Convert the Solr Analytics result set to a format more easily used by display functions.
		**/
        processMdqStats: function(stats) {
            
            var firstDataPeriod;
            
            var allScores = stats.scores.scoresByDateRange;
            var filteredResults = [];
            // Transform result set to an array of lines such as
            //     ["startdate", "enddate", count (for this facet), min score, max score, 25th percentile, median score, 75th percentile]
            // for example:
            //     ["2018-01-01T00:00:00Z", "2019-01-01T00:00:00Z", 63, 0.71428573, 1, 0.85714287, 0.8999999761581421, 0.95238096]
            var results = _.map(allScores, function(score) {
                var datesStr = score.value.replace('[', '').replace(']', '')
                var dates = datesStr.split(' TO ');
                // TODO: use regex for label
                if(score.results.count == 0) {
                    return({label: dates[0].substring(0,4),
                        startDate: dates[0], 
                        endDate: dates[1], 
                        count: score.results.count, 
                        min: 0, 
                        max: 0, 
                        pct25: 0, 
                        median: 0, 
                        pct75: 0});
			};
                // Convert all values to percentages
                // TODO: use regex to extract label
                return({label: dates[0].substring(0,4),
                    startDate: dates[0],
                    endDate: dates[1],
                    count: score.results.count,
                    min: score.results.min_score * 100.0,
                    max: score.results.max_score * 100.0,
                    pct25: score.results.pctl_25 * 100.0,
                    median: score.results.median * 100.0,
                    pct75: score.results.pctl_75 * 100.0});
            }, this);
            
            // TODO: update the filtering to only filter leading and trailing zero count entries
            var foundStart = false;
            filteredResults = _.filter(results, function(score) {
                // Skip over initial enties with a count of 0, so that we find the first
                // date range when data was actually uploaded. Once we have found the first 
                // time period of data, show all groupings after that.
                if (score.count == 0) {
                    // Return true unless wh are past the start of data
                    if(foundStart) {
                        return true;
                    } else {
                        return false;
                    }
                } else {
                    if (!foundStart) foundStart = true;
                    return true
                }
            });
            
            return filteredResults;
		}
	});
    
	return Stats;
});
