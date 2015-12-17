'use strict';
var when = require("when");
var should = require('should');
var sinon = require("sinon");

var deepFilter = require('../../lib/deep-filter');

module.exports = function() {
  /* jshint undef: false */
  describe("Deep filter", function() {
    var config = {};
    var fortuneClient = {};

    beforeEach(function() {
      config.resource = "user";
      config.request = {
        query: { filter: {} }
      };
      fortuneClient = {
        resources: [
          {
            name: "user",
            route: "users",
            schema: {
              posts: [{
                ref: "post",
                external: true
              }],
              name: String
            }
          },
          {
            name: "post",
            route: "posts",
            schema: {
              title: String,
              amount: Number
            }
          }
        ],
        get: sinon.stub().returns(when.resolve({}))
      };
    });

    function setFilter(filter) {
      config.request.query.filter = filter;
    }
    function getFilter() {
      return config.request.query.filter;
    }

    it("should correctly pass simple filters", function(done) {
      setFilter({ title: "Education" });
      var sourceFilter = getFilter();

      deepFilter.modifyFilter(config, fortuneClient)
        .then(function() {
          fortuneClient.get.called.should.be.false;
          var newFilter = getFilter();
          newFilter.should.eql(sourceFilter);
          done();
        }).catch(done);
    });

    it("should flatten filters by external resource fields", function(done) {
      setFilter({ posts: { amount: { $gt: 5 }}}); // /users?filter[posts][amount][$gt]=5

      var reqParams = {
        fields: 'id',
        filter: { amount: { $gt: 5 }},
        limit: 0,
        userAuthToken: undefined
      };
      fortuneClient.get.withArgs("posts", reqParams).returns(when.resolve({
        posts: [
          { id: "firstid" },
          { id: "secondid" }
        ]
      }));

      var expected = { posts: { $in: ["firstid", "secondid"]}};
      deepFilter.modifyFilter(config, fortuneClient)
        .then(function() {
          fortuneClient.get.calledWith("posts", reqParams).should.be.true;
          var newFilter = getFilter();
          newFilter.should.eql(expected);
          done();
        }).catch(done);
    });

    it("should not interfere if initial request filters reference by ids", function(done) {
      setFilter({ posts: { in: "postone,posttwo" }}); // /users?filter[posts][in]=postone,posttwo

      var oldFilter = getFilter();
      deepFilter.modifyFilter(config, fortuneClient)
        .then(function() {
          fortuneClient.get.called.should.be.false;
          var newFilter = getFilter();
          newFilter.should.eql(oldFilter);
          done();
        }).catch(done);
    });

    it("should be able to work with regex query", function(done) {
      setFilter({ posts: { title: { regex: "title" }}}); // /users?filter[posts][title][regex]=title

      var reqParams = {
        fields: 'id',
        filter: { title: { regex: "title" }},
        limit: 0,
        userAuthToken: undefined
      };
      fortuneClient.get.withArgs("posts", reqParams).returns(when.resolve({
        posts: [{ id: "postone" }]
      }));

      var expected = { posts: { $in: ["postone"] }};
      deepFilter.modifyFilter(config, fortuneClient)
        .then(function() {
          fortuneClient.get.calledWith("posts", reqParams).should.be.true;
          var newFilter = getFilter();
          newFilter.should.eql(expected);
          done();
        }).catch(done);
    });
  });
};
