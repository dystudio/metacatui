"use strict";

define(["chai", "chai-jquery", "chai-backbone",
    "../../../../../src/js/models/project/ProjectModel",
    "text!example-files/project.xml"],
    function(chai, chaiJquery, chaiBackbone, Project, ExampleProjectXML) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        // Pull in Jquery and Backbone-specific assertion libraries
        chai.use(chaiJquery); // exported from chai-jquery.js
        chai.use(chaiBackbone); // exported from chai-backbone.js

        describe("ProjectModel Test Suite", function (){
            var projectModel;

            /* Setup */
            before(function() {
                // If needed
                projectModel = new Project({
                  objectDOM: $.parseXML(ExampleProjectXML)
                });
            });

            /* Tear down */
            after(function() {
                // If needed
            });

            describe("The ProjectModel", function() {

              it('should exist', function() {
                  expect(projectModel).to.exist;
                  projectModel.should.exist;
              });

              it('should have a type attribute of Project', function() {
                  projectModel.type.should.equal("Project");
              });
            });

            describe(".parse()", function() {

              it("should not throw an error", function() {
                // Parse the project example XML and set it on the model
                expect(projectModel.set(projectModel.parse())).to.not.throw();
              });

              //Check that the name attribute is a string with at least one character
              it("should have a `name`", function(){
                expect(projectModel.get("name")).to.be.a("string").to.have.lengthOf.above(1);
              });

              //Check that the label attribute is a string with at least one character
              it("should have a `label`", function(){
                expect(projectModel.get("label")).to.be.a("string").to.have.lengthOf.above(1);
              });

              //Check that the description attribute is a string with at least one character
              it("should have a `description`", function(){
                expect(projectModel.get("description")).to.be.a("string").to.have.lengthOf.above(1);
              });


            });
        });


    });
