define(["jquery",
        "underscore",
        "backbone",
        "models/ProjectModel",
        "models/Search",
        "models/Stats",
        "text!templates/alert.html",
        "text!templates/project/project.html",
        "views/project/ProjectHeaderView",
        "views/project/ProjectDataView",
        "views/project/ProjectSectionView",
        "views/project/ProjectMembersView",
        "views/StatsView",
        "views/project/ProjectLogosView"
    ],
    function($, _, Backbone, Project, SearchModel, StatsModel, AlertTemplate, ProjectTemplate, ProjectHeaderView,
        ProjectDataView, ProjectSectionView, ProjectMembersView, StatsView, ProjectLogosView) {
        "use_strict";
        /* The ProjectView is a generic view to render
         * projects, it will hold project sections
         */
        var ProjectView = Backbone.View.extend({

            /* The Project Element*/
            el: "#Content",

            type: "Project",

            subviews: new Array(), // Could be a literal object {} */

            // @type {Project} - A Project Model is associated with this view and gets created during render()
            model: null,

            /* Renders the compiled template into HTML */
            template: _.template(ProjectTemplate),
            //A template to display a notification message
            alertTemplate: _.template(AlertTemplate),

            /* The events that this view listens to*/
            events: {
                "click #project-metrics-tab": "renderMetricsView"
            },

            initialize: function(options) {
                // Set the current ProjectView properties
                this.projectId = options.projectId ? options.projectId : undefined;
                this.projectName = options.projectName ? options.projectName : undefined;
                this.projectSection = options.projectSection ? options.projectSectrion : undefined;
            },

            /*
             * Renders the ProjectView
             *
             * @return {ProjectView} Returns itself for easy function stacking in the app
             */
            render: function() {

                $("body").addClass("ProjectView");

                // Create a new Project model
                this.model = new Project({
                    id: this.projectId
                });

                // When the model has been synced, render the results
                this.stopListening();
                this.listenTo(this.model, "sync", this.renderProject);

                //If the project isn't found, display a 404 message
                this.listenToOnce(this.model, "notFound", this.showNotFound);

                //Fetch the model
                this.model.fetch();

                return this;
            },

            renderProject: function() {

                //Make the JSON to send to the template
                var templateVariables = this.model.toJSON();

                //Make the color rgba string
                templateVariables.primaryColorTransparent = "rgba(" + this.model.get("primaryColorRGB").r +
                  "," + this.model.get("primaryColorRGB").g + "," + this.model.get("primaryColorRGB").b +
                  ", .5)";
                templateVariables.secondaryColorTransparent = "rgba(" + this.model.get("secondaryColorRGB").r +
                  "," + this.model.get("secondaryColorRGB").g + "," + this.model.get("secondaryColorRGB").b +
                  ", .5)";
                templateVariables.accentColorTransparent = "rgba(" + this.model.get("accentColorRGB").r +
                  "," + this.model.get("accentColorRGB").g + "," + this.model.get("accentColorRGB").b +
                  ", .5)";

                // Insert the overall project template
                this.$el.html(this.template(templateVariables));

                //Render the header view
                this.headerView = new ProjectHeaderView({
                    model: this.model
                });
                this.headerView.render();
                this.subviews.push(this.headerView);

                // Create a Filters collection in the search model for all search constraints in this view
                this.model.get("searchModel").set("filters", this.model.createFilters());

                // Cache this model for later use
                MetacatUI.projects = MetacatUI.projects || {};
                MetacatUI.projects[this.model.get("id")] = this.model.clone();

                //Render the content sections
                _.each(this.model.get("sections"), function(section){
                  this.addSection(section);
                }, this);

                // Render the Data section
                if(!this.model.get("hideData")) {
                    this.sectionDataView = new ProjectDataView({
                        model: this.model,
                        id: "data"
                    });
                    this.subviews.push(this.sectionDataView);

                    //Render the section view and add it to the page
                    this.sectionDataView.render();
                    this.$("#project-sections").append(this.sectionDataView.el);

                    this.addSectionLink( this.sectionDataView, "Data" );
                }

                // Render the members section
                if (!this.model.get("hideMembers")) {
                    this.sectionMembersView = new ProjectMembersView({
                        model: this.model,
                        id: "members"
                    });
                    this.subviews.push(this.sectionMembersView);

                    //Render the section view and add it to the page
                    this.sectionMembersView.render();
                    this.$("#project-sections").append(this.sectionMembersView.el);

                    this.addSectionLink( this.sectionMembersView, "Members" );
                }

                //After all the sections are rendered, mark the first one as active
                this.$("#project-sections").children().first().addClass("active");
                this.$("#project-section-tabs").children().first().addClass("active");

                //Space out the tabs evenly
                var widthEach = 100/this.$("#project-section-tabs").children().length;
                this.$("#project-section-tabs").children().css("width", widthEach + "%");

                //Render the logos at the bottom of the project page
                var ackLogos = this.model.get("acknowledgmentsLogos") || [];
                this.logosView = new ProjectLogosView();
                this.logosView.logos = ackLogos;
                this.subviews.push(this.logosView);
                this.logosView.render();
                this.$(".project-view").append(this.logosView.el);

            },

            /*
            * Creates a ProjectSectionView to display the content in the given project
            * section. Also creates a navigation link to the section.
            *
            * @param {ProjectSectionModel} sectionModel - The section to render in this view
            */
            addSection: function(sectionModel){

              //Create a new ProjectSectionView
              var sectionView = new ProjectSectionView({
                model: sectionModel
              });

              //Render the section
              sectionView.render();

              //Add the section view to this project view
              this.$("#project-sections").append(sectionView.el);

              this.addSectionLink(sectionView, sectionModel.get("label"));

            },

            /*
            * Add a link to a section of this project page
            */
            addSectionLink: function(sectionView, label){

              //Create a navigation link
              this.$("#project-section-tabs").append(
                $(document.createElement("li"))
                  .append( $(document.createElement("a"))
                             .text(label)
                             .attr("href", "#" + sectionView.$el.attr("id") )
                             .attr("data-toggle", "tab")));

            },

            /*
            * Render the metrics section
            */
            renderMetricsView: function() {

              if( this.model.get("hideMetrics") ) {
                return;
              }

              //If this subview is already rendered, exit
              if( this.sectionMetricsView ){
                return;
              }

              //If the search results haven't been fetched yet, wait. We need the
              // facet counts for the metrics view.
              if( !this.model.get("searchResults").models.length ){
                this.listenToOnce( this.model.get("searchResults"), "sync", this.renderMetricsView );
                return;
              }

              //Get all the facet counts from the search results collection
              var facetCounts = this.model.get("searchResults").facetCounts,
                  //Get the id facet counts
                  idFacets = facetCounts? facetCounts.id : [],
                  //Get the documents facet counts
                  documentsFacets = facetCounts? facetCounts.documents : [],
                  //Start an array to hold all the ids
                  allIDs = [];

              //If there are resource map facet counts, get all the ids
              if( idFacets && idFacets.length ){

                //Merge the id and documents arrays
                var allFacets = idFacets.concat(documentsFacets);

                //Get all the ids, which should be every other element in the
                // facets array
                for( var i=0; i < allFacets.length; i+=2 ){
                  allIDs.push( allFacets[i] );
                }

                //Create a search model that filters by all the data object Ids
                var statsSearchModel = new SearchModel({
                  idOnly: allIDs,
                  formatType: [],
                  exclude: []
                });

                //Create a StatsModel
                var statsModel = new StatsModel({
                  query: statsSearchModel.getQuery(),
                  searchModel: statsSearchModel,
                  supportDownloads: false
                });

              }

              // add a stats view
              this.sectionMetricsView = new StatsView({
                  title: "Statistics and Figures",
                  description: "A summary of all datasets from " + this.model.get("label"),
                  el: "#project-metrics",
                  model: statsModel
              });

              this.sectionMetricsView.render();
              this.sectionMetricsView.$el.attr("id", "metrics");

              this.subviews.push(this.sectionMetricsView);

              this.addSectionLink(this.sectionMetricsView, "Metrics");

            },

            /*
            * If the given project doesn't exist, display a Not Found message.
            */
            showNotFound: function(){

              var notFoundMessage = "The project \"" + (this.projectName || this.projectId) +
                                    "\" doesn't exist.",
                  notification = this.alertTemplate({
                    classes: "alert-error",
                    msg: notFoundMessage,
                    includeEmail: true
                  });

              this.$el.html(notification);

            },

            /*
             * This function is called when the app navigates away from this view.
             * Any clean-up or housekeeping happens at this time.
             */
            onClose: function() {
                //Remove each subview from the DOM and remove listeners
                _.invoke(this.subviews, "remove");

                this.subviews = new Array();

                delete this.sectionMetricsView;

                $("body").removeClass("ProjectView");
            }
        });

        return ProjectView;
    });
