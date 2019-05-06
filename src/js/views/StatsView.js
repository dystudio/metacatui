/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'LineChart', 'BarChart', 'DonutChart', 'CircleBadge', 'text!templates/profile.html', 'text!templates/alert.html', 'text!templates/loading.html'], 				
	function($, _, Backbone, d3, LineChart, BarChart, DonutChart, CircleBadge, profileTemplate, AlertTemplate, LoadingTemplate) {
	'use strict';
			
	var StatsView = Backbone.View.extend({

		el: '#Content',

    hideUpdatesChart: false,

		template: _.template(profileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
		loadingTemplate: _.template(LoadingTemplate),
						
		initialize: function(options){
			if(!options) options = {};
			
			this.title = (typeof options.title === "undefined") ? "Summary of Holdings" : options.title;
			this.description = (typeof options.description === "undefined") ? 
					"A summary of all datasets in our catalog." : options.description;
			if(typeof options.el === "undefined")
				this.el = options.el;

      this.hideUpdatesChart = (options.hideUpdatesChart === true)? true : false;

      this.model = options.model || MetacatUI.statsModel;
		},
				
		render: function () {
			
			//Clear the page 
			this.$el.html("");
			
			//Only trigger the functions that draw SVG charts if d3 loaded correctly
			if(d3){
				//this.listenTo(this.model, 'change:dataUploadDates',       this.drawUploadChart);
				this.listenTo(this.model, 'change:temporalCoverage',      this.drawCoverageChart);
				this.listenTo(this.model, 'change:metadataDownloadDates', this.drawDownloadsChart);
				this.listenTo(this.model, 'change:dataDownloadDates',     this.drawDownloadsChart);
				this.listenTo(this.model, 'change:downloadDates',     this.drawDownloadsChart);
				this.listenTo(this.model, "change:dataUpdateDates",       this.drawUpdatesChart);
				this.listenTo(this.model, "change:totalSize",             this.drawTotalSize);
				this.listenTo(this.model, 'change:metadataCount', 	    this.drawTotalCount);
				this.listenTo(this.model, 'change:dataFormatIDs', 	  this.drawDataCountChart);
				this.listenTo(this.model, 'change:metadataFormatIDs', this.drawMetadataCountChart);

				//this.listenTo(this.model, 'change:dataUploads', 	  this.drawUploadTitle);
			    // mdq
			    this.listenTo(this.model, 'change:mdqStats',	  	  this.drawMdqChart);
			}

			this.listenTo(this.model, 'change:downloads', 	  this.drawDownloadTitle);
			this.listenTo(this.model, 'change:lastEndDate',	  	  this.drawCoverageChartTitle);
			this.listenTo(this.model, "change:totalCount", this.showNoActivity);

			// set the header type
			MetacatUI.appModel.set('headerType', 'default');
            var qualityChartDescription = MetacatUI.appModel.get('mdqQualityChartDescription');

			//Insert the template
			this.$el.html(this.template({
				query: this.model.get('query'),
				title: this.title,
				description: this.description,
                qualityChartDescription: qualityChartDescription
			}));

			//Insert the loading template into the space where the charts will go
			if(d3){
				this.$(".chart").html(this.loadingTemplate);
				this.$(".show-loading").html(this.loadingTemplate);
			}
			//If SVG isn't supported, insert an info warning
			else{
				this.$el.prepend(this.alertTemplate({
					classes: "alert-info",
					msg: "Please upgrade your browser or use a different browser to view graphs of these statistics.",
					email: false
				}));
			}

			if(!this.model.get("supportDownloads"))
				this.$(".stripe.downloads").remove();

      //Hide the Latest Updates chart if it's turned off
      if( this.hideUpdatesChart ){
        this.$(".stripe.updates").remove();
      }

			//Start retrieving data from Solr
			this.model.getAll();

			return this;
		},

		drawDataCountChart: function(){
			var dataCount = this.model.get('dataCount');
			var data = this.model.get('dataFormatIDs');

			if(dataCount){
				var svgClass = "data";
			}
			else if(!this.model.get('dataCount') && this.model.get('metadataCount')){	//Are we drawing a blank chart (i.e. 0 data objects found)?
				var svgClass = "data default";
			}
			else if(!this.model.get('metadataCount') && !this.model.get('dataCount'))
				var svgClass = "data no-activity";

			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('.format-charts-data').html("<h2 class='" + svgClass + " fallback'>" + MetacatUI.appView.commaSeparateNumber(dataCount) + " data files</h2>");

				return;
			}

			//Draw a donut chart
			var donut = new DonutChart({
							id: "data-chart",
							data: data,
							total: this.model.get('dataCount'),
							titleText: "data files",
							titleCount: dataCount,
							svgClass: svgClass,
							countClass: "data",
							height: 300,
							formatLabel: function(name){
								//If this is the application/vnd.ms-excel formatID - let's just display "MS Excel"
								if((name !== undefined) && (name.indexOf("ms-excel") > -1)) name = "MS Excel";
								else if((name != undefined) && (name == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) name= "MS Excel OpenXML"
								else if((name != undefined) && (name == "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) name= "MS Word OpenXML"
								//Application/octet-stream - shorten it
								else if((name !== undefined) && (name == "application/octet-stream")) name = "Application file";
								
								if(name === undefined) name = "";
								
								return name;
							}
						});
			this.$('.format-charts-data').html(donut.render().el);
		},

		drawMetadataCountChart: function(){
			var metadataCount = this.model.get("metadataCount");
			var data = this.model.get('metadataFormatIDs');

			if(metadataCount){
				var svgClass = "metadata";
			}
			else if(!this.model.get('metadataCount') && this.model.get('dataCount')){	//Are we drawing a blank chart (i.e. 0 data objects found)?
				var svgClass = "metadata default";
			}
			else if(!this.model.get('metadataCount') && !this.model.get('dataCount'))
				var svgClass = "metadata no-activity";

			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('.format-charts-metadata').html("<h2 class='" + svgClass + " fallback'>" + MetacatUI.appView.commaSeparateNumber(metadataCount) + " metadata files</h2>");

				return;
			}

			//Draw a donut chart
			var donut = new DonutChart({
							id: "metadata-chart",
							data: data,
							total: this.model.get('metadataCount'),
							titleText: "metadata files",
							titleCount: metadataCount,
							svgClass: svgClass,
							countClass: "metadata",
							height: 300,
							formatLabel: function(name){
								if((name !== undefined) && (name.indexOf("//ecoinformatics.org") > -1)){
									//EML - extract the version only
									if(name.substring(0,4) == "eml:") name = name.substr(name.lastIndexOf("/")+1).toUpperCase().replace('-', ' ');

									//EML modules
									if(name.indexOf("-//ecoinformatics.org//eml-") > -1) name = "EML " + name.substring(name.indexOf("//eml-")+6, name.lastIndexOf("-")) + " " + name.substr(name.lastIndexOf("-")+1, 5);

								}
								//Dryad - shorten it
								else if((name !== undefined) && (name == "http://datadryad.org/profile/v3.1")) name = "Dryad 3.1";
								//FGDC - just display "FGDC {year}"
								else if((name !== undefined) && (name.indexOf("FGDC") > -1)) name = "FGDC " + name.substring(name.length-4);

								if(name === undefined) name = "";
								return name;
							}
						});

			this.$('.format-charts-metadata').html(donut.render().el);
		},

		drawFirstUpload: function(){

			var className = "";

			if( !this.model.get("firstUpload") ){
				var chartData = [{
				              	  count: "N/A",
				              	  className: "packages no-activity"
	                			}];
			}
			else{
				var firstUpload = new Date(this.model.get("firstUpload")),
					readableDate = firstUpload.toDateString();

				readableDate = readableDate.substring(readableDate.indexOf(" ") + 1);

				var chartData = [{
				              	  count: readableDate,
				              	  className: "packages"
	                			}];
			}

			//Create the circle badge
			var dateBadge = new CircleBadge({
				id: "first-upload-badge",
				data: chartData,
				title: "first upload",
				titlePlacement: "inside",
				useGlobalR: true,
				globalR: 100
			});

			this.$("#first-upload").html(dateBadge.render().el);
		},

		//drawUploadChart will get the upload stats from the stats model and draw a time series cumulative chart
		drawUploadChart: function(){
			//Get the width of the chart by using the parent container width
			var parentEl = this.$('.upload-chart');
			var width = parentEl.width() || null;

			//If there was no first upload, draw a blank chart and exit
			if(!this.model.get('firstUpload')){

				var lineChartView = new LineChart(
						{	  id: "upload-chart",
						 	yLabel: "files uploaded",
						 frequency: 0,
						 	 width: width
						});

				this.$('.upload-chart').html(lineChartView.render().el);

				return;
			}

			//Set the frequency of our points
			var frequency = 12;

			//Check which line we should draw first since the scale will be based off the first line
			if(this.model.get("metadataUploads") > this.model.get("dataUploads") ){

				//If there isn't a lot of point to graph, draw points more frequently on the line
				if(this.model.get("metadataUploadDates").length < 40) frequency = 1;

				//Create the line chart and draw the metadata line
				var lineChartView = new LineChart(
						{	  data: this.model.get('metadataUploadDates'),
			  formatFromSolrFacets: true,
						cumulative: true,
								id: "upload-chart",
						 className: "metadata",
						 	yLabel: "files uploaded",
						labelValue: "Metadata: ",
						// frequency: frequency,
							radius: 2,
							width: width,
						    labelDate: "M-y"
						});

				this.$('.upload-chart').html(lineChartView.render().el);

				//Only draw the data file line if there was at least one uploaded
				if(this.model.get("dataUploads")){
					//Add a line to our chart for data uploads
					lineChartView.className = "data";
					lineChartView.labelValue ="Data: ";
					lineChartView.addLine(this.model.get('dataUploadDates'));
				}
			}
			else{
					var lineChartView = new LineChart(
							{	  data: this.model.get('dataUploadDates'),
				  formatFromSolrFacets: true,
							cumulative: true,
									id: "upload-chart",
							 className: "data",
							 	yLabel: "files uploaded",
							labelValue: "Data: ",
						//	 frequency: frequency,
								radius: 2,
								 width: width,
						    labelDate: "M-y"
							 });

					this.$('.upload-chart').html(lineChartView.render().el);

					//If no metadata files were uploaded, we don't want to draw the data file line
					if(this.model.get("metadataUploads")){
						//Add a line to our chart for metadata uploads
						lineChartView.className = "metadata";
						lineChartView.labelValue = "Metadata: ";
						lineChartView.addLine(this.model.get('metadataUploadDates'));
					}
				}
		},

		//drawUploadTitle will draw a circle badge title for the uploads time series chart
		drawUploadTitle: function(){

			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('#uploads-title').html("<h2 class='packages fallback'>" + MetacatUI.appView.commaSeparateNumber(this.model.get('totalUploads')) + "</h2>");

				return;
			}

			if(!this.model.get('dataUploads') && !this.model.get('metadataUploads')){
				//Draw the upload chart title
				var uploadChartTitle = new CircleBadge({
					id: "upload-chart-title",
					className: "no-activity",
					globalR: 60,
					data: [{ count: 0, label: "uploads" }]
				});

				this.$('#uploads-title').prepend(uploadChartTitle.render().el);

				return;
			}

			//Get information for our upload chart title
			var titleChartData = [],
				metadataUploads = this.model.get("metadataUploads"),
				dataUploads = this.model.get("dataUploads"),
				metadataClass = "metadata",
				dataClass = "data";

			if(metadataUploads == 0) metadataClass = "default";
			if(dataUploads == 0) dataClass = "default";


			var titleChartData = [
			                      {count: this.model.get("metadataUploads"), label: "metadata", className: metadataClass},
							      {count: this.model.get("dataUploads"), 	  label: "data", 	 className: dataClass}
								 ];

			//Draw the upload chart title
			var uploadChartTitle = new CircleBadge({
				id: "upload-chart-title",
				data: titleChartData,
				className: "chart-title",
				useGlobalR: true,
				globalR: 60
			});
			this.$('#uploads-title').prepend(uploadChartTitle.render().el);
		},

		/*
		 * drawTotalCount - draws a simple count of total metadata files/datasets
		 */
		drawTotalCount: function(){

			var className = "";

			if( !this.model.get("metadataCount") && !this.model.get("dataCount") )
				className += " no-activity";

			var chartData = [{
	                    	  count: this.model.get("metadataCount"),
	                    	  className: "packages" + className
			                }];

			//Create the circle badge
			var countBadge = new CircleBadge({
				id: "total-datasets-title",
				data: chartData,
				title: "datasets",
				titlePlacement: "inside",
				useGlobalR: true,
				globalR: 100,
				height: 220
			});

			this.$('#total-datasets').html(countBadge.render().el);
		},

		/*
		 * drawTotalSize draws a CircleBadgeView with the total file size of
		 * all current metadata and data files
		 */
		drawTotalSize: function(){

			if( !this.model.get("totalSize") ){
				var chartData = [{
              	  				  count: "0 bytes",
				              	  className: "packages no-activity"
	                			}];

			}
			else{
				var chartData = [{
		                    	  count: this.bytesToSize( this.model.get("totalSize") ),
		                    	  className: "packages"
				                }];
			}

			//Create the circle badge
			var sizeBadge = new CircleBadge({
				id: "total-size-title",
				data: chartData,
				title: "of content",
				titlePlacement: "inside",
				useGlobalR: true,
				globalR: 100,
				height: 220
			});

			this.$('#total-size').html(sizeBadge.render().el);
		},

		/*
		 * drawUpdatesChart - draws a line chart representing the latest updates over time
		 */
		drawUpdatesChart: function(){

			//If there was no first upload, draw a blank chart and exit
			if(!this.model.get('firstUpdate')){

				var lineChartView = new LineChart(
						{	  id: "updates-chart",
						 	yLabel: "files updated",
						 frequency: 0,
						 cumulative: false,
						 	 width: this.$('.metadata-updates-chart').width()
						});

				this.$('.metadata-updates-chart').html(lineChartView.render().el);

				return;
			}

			//Set the frequency of our points
			var frequency = 12;

			//If there isn't a lot of points to graph, draw points more frequently on the line
			if(this.model.get("metadataUpdateDates").length < 40) frequency = 1;

			//Create the line chart for metadata updates
			var metadataLineChart = new LineChart(
					{	  data: this.model.get('metadataUpdateDates'),
		  formatFromSolrFacets: true,
					cumulative: false,
							id: "updates-chart",
					 className: "metadata",
					 	yLabel: "metadata files updated",
					// frequency: frequency,
						radius: 2,
						width: this.$('.metadata-updates-chart').width(),
					    labelDate: "M-y"
					});

			this.$('.metadata-updates-chart').html(metadataLineChart.render().el);

			//Only draw the data updates chart if there was at least one uploaded
			if(this.model.get("dataCount")){
				//Create the line chart for data updates
				var dataLineChart = new LineChart(
						{	  data: this.model.get('dataUpdateDates'),
			  formatFromSolrFacets: true,
						cumulative: false,
								id: "updates-chart",
						 className: "data",
						 	yLabel: "data files updated",
						// frequency: frequency,
							radius: 2,
							width: this.$('.data-updates-chart').width(),
						    labelDate: "M-y"
						});

				this.$('.data-updates-chart').html(dataLineChart.render().el);

			}
			else{
				//Create the line chart for data updates
				var dataLineChart = new LineChart(
						{	  data: null,
			  formatFromSolrFacets: true,
						cumulative: false,
								id: "updates-chart",
						 className: "data no-activity",
						 	yLabel: "data files updated",
						// frequency: frequency,
							radius: 2,
							width: this.$('.data-updates-chart').width(),
						    labelDate: "M-y"
						});

				this.$('.data-updates-chart').html(dataLineChart.render().el);
			}

		},

		/*
		 * drawDownloadsChart - draws a line chart representing the downloads over time
		 */
		drawDownloadsChart: function(){
			//Only draw the chart once both metadata and data dates have been retrieved
			//if(!this.model.get("metadataDownloadDates") || !this.model.get("dataDownloadDates")) return;

			if(!this.model.get("downloadDates")) return;

			//Get the width of the chart by using the parent container width
			var parentEl = this.$('.download-chart');
			var width = parentEl.width() || null;

			//If there are no download stats, show a message and exit
			if(!this.model.get('downloads')){

				var msg = "No one has downloaded any of this data or download statistics are not being reported";
				parentEl.html("<p class='subtle center'>" + msg + ".</p>");

				return;
			}

			//Set the frequency of our points
			var frequency = 6;

			//Check which line we should draw first since the scale will be based off the first line

			var options = {
					data: this.model.get('downloadDates'),
					formatFromSolrFacetRanges: true,
					id: "download-chart",
					yLabel: "all downloads",
					barClass: "packages",
					roundedRect: true,
					roundedRadius: 10,
					barLabelClass: "packages",
					width: width
				};

			var barChart = new BarChart(options);
			parentEl.html(barChart.render().el);

		},

		//drawDownloadTitle will draw a circle badge title for the downloads time series chart
		drawDownloadTitle: function(){

			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('#downloads-title').html("<h2 class='packages fallback'>" + MetacatUI.appView.commaSeparateNumber(this.model.get('downloads')) + "</h2>");

				return;
			}

			//If there are 0 downloads, draw a default/blank chart title
			if(!this.model.get('downloads')){
				var downloadChartTitle = new CircleBadge({
					id: "download-chart-title",
					className: this.model.get("totalUploads") ? "default" : "no-activity",
					globalR: 60,
					data: [{ count: 0, label: "downloads" }]
				});

				this.$('#downloads-title').html(downloadChartTitle.render().el);

				this.listenToOnce(this.model, "change:totalUploads", this.drawDownloadTitle);

				return;
			}

			//Get information for our download chart title
			var titleChartData = [],
				metadataDownloads = this.model.get("metadataDownloads"),
				dataDownloads = this.model.get("dataDownloads"),
				metadataClass = "metadata",
				dataClass = "data";

			if(metadataDownloads == 0) metadataClass = "default";
			if(dataDownloads == 0) dataClass = "default";


			var titleChartData = [
			                      {count: this.model.get("metadataDownloads"), label: "metadata", className: metadataClass},
							      {count: this.model.get("dataDownloads"), 	   label: "data", 	  className: dataClass}
								 ];

			//Draw the download chart title
			var downloadChartTitle = new CircleBadge({
				id: "download-chart-title",
				data: titleChartData,
				className: "chart-title",
				useGlobalR: true,
				globalR: 60
			});

			this.$('#downloads-title').html(downloadChartTitle.render().el);
		},

		//Draw a bar chart for the temporal coverage
		drawCoverageChart: function(e, data){

			//Get the width of the chart by using the parent container width
			var parentEl = this.$('.temporal-coverage-chart');
			var width = parentEl.width() || null;

			// If results were found but none have temporal coverage, draw a default chart
			if(!this.model.get('firstBeginDate')){

				parentEl.html("<p class='subtle center'>There are no metadata documents that describe temporal coverage.</p>");

				return;
			}

				var options = {
						data: data,
						formatFromSolrFacets: true,
						id: "temporal-coverage-chart",
						yLabel: "data packages",
						yFormat: d3.format(",d"),
						barClass: "packages",
						roundedRect: true,
						roundedRadius: 10,
						barLabelClass: "packages",
						width: width
					};

			var barChart = new BarChart(options);
			parentEl.html(barChart.render().el);

		},

		drawCoverageChartTitle: function(){
			if((!this.model.get('firstBeginDate')) || (!this.model.get('lastEndDate'))) return;

			//Create the range query
			var yearRange = this.model.get('firstBeginDate').getUTCFullYear() + " - " + this.model.get('lastEndDate').getUTCFullYear();

			//Find the year range element
			this.$('#data-coverage-year-range').text(yearRange);
		},

        //Draw a line chart for the FAIR suite
        drawMdqChart: function(){

			//Get the width of the chart by using the parent container width
            var parentEl = this.$('.quality-chart');
            var width = parentEl.width() * .70 || null;			
            var displayType = MetacatUI.appModel.get("mdqDisplayType")
            var data = this.model.get('mdqStats');
            
            // TODO: display 'no data' in plot 
            if (data === null || typeof data == "undefined" || data.length == 0) {
                parentEl.hide();
                return;
            }
            
            // Are we usign the FAIR suite? 
            var suiteId = MetacatUI.appModel.get('mdqSuiteIds')[0];
            var regexSuiteId = RegExp("FAIR.suite.*");
            if (displayType == "BoxPlot") {
			var options = {
					data: data,
                        id: "mdq-chart",
                        yLabel: "Quality Score (percentage)",
					yFormat: d3.format(",%"),
                        barClass: "quality",
                        barLabelClass: "quality scores",
					width: width
				};

                var boxPlot = new BoxPlot(options);
                this.$('.mdq-chart').html(boxPlot.render().el);
            } else if (displayType == "LineChart" && regexSuiteId.test(suiteId)) {
                // FAIR Suite
                //If there was no quality scores, draw a default, blank chart
                //if(!this.model.get('mdqStats')){
                if(!data || data.length == 0) {
                    var lineChartView = new LineChart(
                            {	  id: "mdq-chart",
                                yLabel: "Quality score (percentage)",
                             frequency: 1,
                             cumulative: false,
                                 width: this.$('.mdq-chart').width()
                            });

                    this.$('.mdq-chart').html(lineChartView.render().el);
                    return;
                }
                
                var plotData = _.map(data, function(obj) {
                    return( {date: obj.date, count: obj.FindableAve} );
                });
            
                //Create the line chart and draw the metadata line
                // For DataONE FAIR suite, start with the data for 'Findable', as
                // the LineChart can only accept data for one line at a time.
                var lineChartView = new LineChart(
                        {	  data: plotData,
                  formatFromSolrFacets: false,
                        cumulative: false,
                                id: "mdq-chart",
                         className: "mdq-fair-findable",
                            yLabel: "Quality Score (percentage)",
                        labelValue: "Quality: ",
                        frequency: 0,
                            radius: 2,
                            width: width,
                            labelDate: "m-y",
                            max: 100
                        });
    
                // Plot the first line, for FAIR Findable
                this.$('.mdq-chart').html(lineChartView.render().el);

                // ## var newView = lineChartView.render();
                
                // Plot the next line, for FAIR Accessible
                plotData = _.map(data, function(obj) {
                    return {date: obj.date, count: obj.AccessibleAve};
                });
                
                lineChartView.className = "mdq-fair-accessible";
                //lineChartView.labeValue = "Accessible";
                lineChartView.addLine(plotData);
                
                // Plot the next line, for FAIR Interoperable
                plotData = _.map(data, function(obj) {
                    return {date: obj.date, count: obj.InteroperableAve};
                });
                
                lineChartView.className = "mdq-fair-interoperable";
                lineChartView.addLine(plotData);
                
                // Plot the next line, for FAIR Reusable
                plotData = _.map(data, function(obj) {
                    return {date: obj.date, count: obj.ReusableAve};
                });
                lineChartView.className = "mdq-fair-reusable";
                lineChartView.addLine(plotData);
                
                var legendData = [
                        { label: 'Reusable', class: 'mdq-fair-reusable' },
                        { label: 'Interoperable', class: 'mdq-fair-interoperable' },
                        { label: 'Accessible', class: 'mdq-fair-accessible' },
                        { label: 'Findable', class: 'mdq-fair-findable'}
                ];

                lineChartView.addLegend(legendData);
            } else if (displayType == "LineChart" && (RegExp("knb.*").test(suiteId) || RegExp("arctic.*").test(suiteId))) {
                // Arctic Data Center, KNB
                //If there was no quality scores, draw a default, blank chart
                console.log("drawing arctic view");
                if(!data || data.length == 0) {
                    var lineChartView = new LineChart(
                            {	  id: "mdq-chart",
                                yLabel: "Quality score (percentage)",
                             frequency: 1,
                             cumulative: false,
                                 width: this.$('.mdq-chart').width()
                            });

                    this.$('.mdq-chart').html(lineChartView.render().el);
                    return;
                }
                
                var plotData = _.map(data, function(obj) {
                    return( {date: obj.date, count: obj.discoveryAve} );
                });
            
                //Create the line chart and draw the metadata line
                var lineChartView = new LineChart({
                        data: plotData,
                        formatFromSolrFacets: false,
                        cumulative: false,
                                id: "mdq-chart",
                         className: "mdq-discovery",
                            yLabel: "Quality Score (percentage)",
                        labelValue: "Quality: ",
                        frequency: 0,
                            radius: 2,
                            width: width,
                            labelDate: "m-y",
                            max: 100
                });
    
                this.$('.mdq-chart').html(lineChartView.render().el);

                plotData = _.map(data, function(obj) {
                    return {date: obj.date, count: obj.interpretationAve};
                });
                
                lineChartView.className = "mdq-interpretation";
                lineChartView.addLine(plotData);
                
                plotData = _.map(data, function(obj) {
                    return {date: obj.date, count: obj.identificationAve};
                });
                
                lineChartView.className = "mdq-identification";
                lineChartView.addLine(plotData);
                
                var legendData = [
                        { label: 'Interpretation', class: 'mdq-interpretation' },
                        { label: 'Identification', class: 'mdq-identification' },
                        { label: 'Discovery', class: 'mdq-discovery' }
                ];

                lineChartView.addLegend(legendData);
            } else {
                // Plot the overall score
                plotData = _.map(data, function(obj) {
                    return {date: obj.date, count: obj.mean};
                });

                var lineChartView = new LineChart(
                        {	  data: plotData,
                  formatFromSolrFacets: false,
                        cumulative: false,
                                id: "mdq-chart",
                         className: "data",
                            yLabel: "Quality Score Overall (percentage)",
                        labelValue: "Quality: ",
                        frequency: 1,
                            radius: 2,
                            width: width,
                            labelDate: "m-y",
                            max: 100
                        });
    
                // Plot the first line, for FAIR Findable
                this.$('.mdq-chart').html(lineChartView.render().el);
            }
		},

		/*
		 * Shows that this person/group/node has no activity
		 */
		showNoActivity: function(){
			this.$(".show-loading .loading").remove();

			this.$el.addClass("no-activity");
		},

				/**
		 * Convert number of bytes into human readable format
		 *
		 * @param integer bytes     Number of bytes to convert
		 * @param integer precision Number of digits after the decimal separator
		 * @return string
		 */
		bytesToSize: function(bytes, precision){
		    var kilobyte = 1024;
		    var megabyte = kilobyte * 1024;
		    var gigabyte = megabyte * 1024;
		    var terabyte = gigabyte * 1024;

		    if(typeof bytes === "undefined") var bytes = this.get("size");

		    if ((bytes >= 0) && (bytes < kilobyte)) {
		        return bytes + ' B';

		    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
		        return (bytes / kilobyte).toFixed(precision) + ' KB';

		    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
		        return (bytes / megabyte).toFixed(precision) + ' MB';

		    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
		        return (bytes / gigabyte).toFixed(precision) + ' GB';

		    } else if (bytes >= terabyte) {
		        return (bytes / terabyte).toFixed(precision) + ' TB';

		    } else {
		        return bytes + ' B';
		    }
		},

		onClose: function () {
			//Clear the template
			this.$el.html("");

			//Stop listening to changes in the model
			this.stopListening(this.model);

			//Reset the stats model
			this.model.clear().set(this.model.defaults);
		}

	});

	return StatsView;
});
