/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'], 				
	function($, _, Backbone, d3) {
	'use strict';
		
	// Build the main header view of the application
	var BoxPlotView = Backbone.View.extend({
				
		initialize: function (options) {
			/* OPTIONS:
			 * 	data: An array of objects that represents the data to be graphed. Pass in a format of {"x axis label": y-axis number, "className": "class attribute string"}. Example:
			 * 			[{x: "2009", y: 20, "className": "bar"}]
			 * 			Any objects with the same x value will be graphed as overlapping bars on the same spot on the x-axis, so stacked bar charts can be created that way.
			 *  id: The id to use for the svg element
			 * 	className = class to give the SVG element
			 *  barClass = a class to give every bar element
			 *  yLabel = the text of the label along the y-axis
			 *  yFormat = the format to use for the y-axis tick marks, in d3.format syntax (https://github.com/mbostock/d3/wiki/Formatting#d3_format)
			 *  width = width of SVG element
			 *  height = height of SVG element
			 *  roundedRect = pass true to rounded the top corners of the bars. Use false for stacked bar charts
			 *  displayBarLabel = pass false to turn off the count labels displayed at the top of each bar
			 *  hideBarLabels = if set to true, the bar labels will be in the DOM but will only be shown on mouseover.
			 */
            this.data      = options.data      || [{count: 0, startDate: "", endDate: "", label: "", max: 0, median: 0, min: 0, pct25: 0, pct75: 0}]; 
			this.id 	   = options.id 	   || "quality-scores";
			this.className = options.className || "";
            this.barClass  = options.barClass  || "";
            this.barLabelClass = options.barLabClass || "";
			this.yLabel	   = options.yLabel	   || "";
			this.yFormat   = options.yFormat   || null;
			this.width 	   = options.width 	   || 650;
			this.height    = options.height    || 320;
            this.displayMin  = options.displayMin || 0;
            this.displayMax  = options.displayMax || 100;
			
			//If there are less than 3 data objects (3 bars)
			if((this.data.length < 3) && (this.width > 650)){
				this.width = 650; 
			}			
		},
		
		// http://stackoverflow.com/questions/9651167/svg-not-rendering-properly-as-a-backbone-view
		// Give our el a svg namespace because Backbone gives a different one automatically
		nameSpace: "http://www.w3.org/2000/svg",
		  _ensureElement: function() {
		     if (!this.el) {
		        var attrs = _.extend({}, _.result(this, 'attributes'));
		        if (this.id) attrs.id = _.result(this, 'id');
		        if (this.className) attrs['class'] = _.result(this, 'className');
		        var $el = $(window.document.createElementNS(_.result(this, 'nameSpace'), _.result(this, 'tagName'))).attr(attrs);
		        this.setElement($el, false);
		     } else {
		        this.setElement(_.result(this, 'el'), false);
		     }
		 },
				
		tagName: "svg",
				
		/*
		 * --Adapted from http://bl.ocks.org/mbostock/7441121--
		 * This function draws a simple bar chart
		 */
		render: function () {			
			var viewRef = this;
            // TODO: calculate this based on # of bars in chart
            var barWidth = 30;
	
			var margin = {top: 20, right: 15, bottom: 65, left: 55},
		    	viewWidth = this.width - (margin.left + margin.right),
		    	viewHeight = this.height - (margin.top + margin.bottom);
			
			this.margin = margin;
            
            var globalMin = Number.MAX_SAFE_INTEGER;
            var globalMax = Number.NEGATIVE_INFINITY;
            
            this.data.forEach(function(x) {
                globalMin = Math.min(globalMin, x.min);
                globalMax = Math.max(globalMax, x.max);
            });

            // Extract the label element which should be the start of the date range, either year (e.g. "2015") or 
            // month (e.g. "Jan 2015")
            var labels = [];
            labels = _.map(this.data, function(datum) {
                return(datum.label);
            });
            // Compute an ordinal xScale for the labels in data
            var xScale = d3.scale.ordinal()
              .domain(labels)
              .rangePoints([margin.left, margin.left+viewWidth], .3)

              // Note: invert the y scale so that the origin is at the bottom left, not top left as is the
              //   default with SVG
              var yScale = d3.scale.linear()
                //.domain([globalMin, globalMax])
                .domain([this.displayMin, this.displayMax])
                //.range([height + margin.bottom, 0]);
                //.range([height, this.margin.bottom]);
                .range([viewHeight + this.margin.top, this.margin.top]);
                
              // Setup the svg and group we will draw the box plot in
              var svg = d3.select(this.el)
                .attr("class", "box-plot " + this.className)
                .attr("width", this.width)
                .attr("height", this.height)
                
                var yAxis = d3.svg.axis()
                    .scale(yScale)
                    .orient("left")
                    .innerTickSize(["-" + viewWidth + this.margin.right])
                    //.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
                    
                svg.append("g")
                .attr("class", "y axis")
                .attr("transform", "translate(" + this.margin.left + ",0)") 
                .call(yAxis);
                /*
                  * ========================================================================
                  * Draw the y-axis title
                  * ========================================================================
                */
                svg.append("text")
                    .attr("y", 6)
                    .attr("dy", ".71em")
                    .style("text-anchor", "middle")
                    .text(this.yLabel)
                    .attr("class", "title")
                    .attr("transform", "translate(-5, " + (this.height/2) + ") rotate(-90)");

                //.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                // Move the left axis over 25 pixels, and the top axis over 35 pixels
                //var axisG = svg.append("g").attr("transform", "translate(25,0)");
                //var axisTopG = svg.append("g").attr("transform", "translate(25,0)");

                // Setup the group the box plot elements will render in
                //var g = svg.append("g")
                //  .attr("transform", "translate(20,5)");
                var g = svg.append("g");
                

                // Draw the box plot vertical lines
                var verticalLines = g.selectAll(".verticalLines")
                  .data(this.data)
                  .enter()
                  .append("line")
                  .attr("x1", function(datum) {
                      return xScale(datum.label) + barWidth/2;
                    }
                  )
                  .attr("y1", function(datum) {
                      var whisker = datum.min;
                      return yScale(whisker);
                    }
                  )
                  .attr("x2", function(datum) {
                      return xScale(datum.label) + barWidth/2;
                    }
                  )
                  .attr("y2", function(datum) {
                      var whisker = datum.max;
                      return yScale(whisker);
                    }
                  )
                  .attr("stroke", "#000")
                  .attr("stroke-width", 1)
                  .attr("fill", "none");

                // Draw the boxes of the box plot, filled in white and on top of vertical lines
                var rects = g.selectAll("rect")
                  .data(this.data)
                  .enter()
                  .append("rect")
                  .attr("width", barWidth)
                  .attr("height", function(datum) {
                      var height = Math.abs(yScale(datum.pct75) - yScale(datum.pct25));
                      return height;
                    }
                  )
                  .attr("x", function(datum) {
                      return xScale(datum.label);
                    }
                  )
                  .attr("y", function(datum) {
                      // Base of rectangle is the "top", which is 75 quartile (to invert rectangle)
                      return yScale(datum.pct75);
                    }
                  )
                  // TODO use CSS to set color
                  .attr("fill", "#9AD18F")
                  .attr("stroke", "#000")
                  .attr("stroke-width", 1);

                // Now render all the horizontal lines at once - the whiskers and the median
                var horizontalLineConfigs = [
                  // Top whisker
                  {
                    x1: function(datum) { return xScale(datum.label) },
                    y1: function(datum) { return yScale(datum.min) },
                    x2: function(datum) { return xScale(datum.label) + barWidth },
                    y2: function(datum) { return yScale(datum.min) }
                  },
                  // Median line
                  {
                    x1: function(datum) { return xScale(datum.label) },
                    y1: function(datum) { return yScale(datum.median) },
                    x2: function(datum) { return xScale(datum.label) + barWidth },
                    y2: function(datum) { return yScale(datum.median) }
                  },
                  // Bottom whisker
                  {
                    x1: function(datum) { return xScale(datum.label) },
                    y1: function(datum) { return yScale(datum.max) },
                    x2: function(datum) { return xScale(datum.label) + barWidth },
                    y2: function(datum) { return yScale(datum.max) }
                  }
                ];

                for(var i=0; i < horizontalLineConfigs.length; i++) {
                  var lineConfig = horizontalLineConfigs[i];

                  // Draw the whiskers at the min for this series
                  var horizontalLine = g.selectAll(".whiskers")
                    .data(this.data)
                    .enter()
                    .append("line")
                    .attr("x1", lineConfig.x1)
                    .attr("y1", lineConfig.y1)
                    .attr("x2", lineConfig.x2)
                    .attr("y2", lineConfig.y2)
                    .attr("stroke", "#000")
                    .attr("stroke-width", 1)
                    .attr("fill", "none");
                }
                
                // Move the left axis over 25 pixels, and the top axis over 35 pixels
                //var axisBottomG = svg.append("g").attr("transform", "translate(20,10");
                //var axisBottomG = svg.append("g").attr("transform", "translate(20," + this.width + this.top + ')"');
                var axisBottomG = svg.append("g").attr("transform", "translate(15, 255)")
                //var axisTop = d3.axisBottom(xScale);
                var axisBottom = d3.svg.axis()
                            .scale(xScale)
                            .orient("bottom");
                            
                axisBottomG.append("g")
                  .call(axisBottom)
                  .selectAll("text")
                  .style("text-anchor", 'end')
                  .attr("dx", "-.8em")
                  .attr("dy", ".15em")
                  .attr("transform", "rotate(-65)");

                  //.attr("transform", "rotate(-65)");
                  
                      
				return this;
		}
	});
	return BoxPlotView;		
});
