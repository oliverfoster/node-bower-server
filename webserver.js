var express = require('express'),
    Q = require('q'),
    request = require('request'),
    util = require("util");

var WebServer = {
    init: function () {
        this.app = express();
        this.app.use(express.bodyParser());

        this.app.get('/packages', function(req, res){
            this.pkg.findAll({order: 'name DESC'}).then(function(packages) {
                res.send(packages);
            });
        }.bind(this));

        this.app.post('/packages', function (req, res) {
          var name, url, pkg;
          name = req.param('name');
          url = req.param('url');
          pkg = this.pkg.build({name: name, url: url});
          pkg.validate().then(function(errors){
              if(!errors){
                pkg.save().then(function () {
                  res.send(201);
                }).catch(function (e) {
                  res.send(406);
                });
              }
              else{
                console.log(errors);
                res.send(400);
              }
          });
        }.bind(this));

        this.app.get('/packages/:name', function (req, res) {
          var name = req.params.name;
          this.pkg.find({where: ["name = ?", name]}).then(function(pkg) {
            if(pkg){
              pkg.hit();
              res.send(pkg.toJSON());
            }
            else{
              res.send(404);
            }
          });
        }.bind(this));

        this.app.get('/packages/search/:name', function (req, res) {
          var name = req.params.name;
          this.pkg.findAll({where: ["name ilike ?", '%'+name+'%'], order: 'name DESC'}).then(function(packages) {
            res.send(packages);
          });
        }.bind(this));

        this.app.get('/packages/rename/:owner/:name/:username/:oldPluginName/:newPluginName', function (req, res) {
          var params = {
            owner:req.params.owner,
            name:req.params.name,
            username:req.params.username,
            oldPluginName:req.params.oldPluginName,
            newPluginName:req.params.newPluginName,
            url:'https://api.github.com/repos/'+req.params.owner+'/'+req.params.name+'/collaborators/'+req.params.username,
            auth_token:req.query.access_token
          };

           Q(params)
          .then(this.authorize.bind(this))
          .thenResolve(this.pkg.find.bind(this.pkg))
          .fcall({where: ["name = ?", params.oldPluginName]})
          .then(function(pkg) {
            return pkg ? Q.resolve(pkg.rename(params.newPluginName)) : Q.reject();
          })
          .then(function() {
            res.send(201);
          })
          .catch(function(err) {
            console.log(err);
            res.send(404);
          })
          .done();

        }.bind(this));

        this.app.delete('/packages/:owner/:name/:username/:pluginName', function (req, res) {
          var params = {
            owner:req.params.owner,
            name:req.params.name,
            username:req.params.username,
            pluginName:req.params.pluginName,
            url:'https://api.github.com/repos/'+req.params.owner+'/'+req.params.name+'/collaborators/'+req.params.username,
            auth_token:req.query.access_token
          };

          this.pkg.find({where: ["name = ?", params.pluginName]})
          .then(this.checkResult)
          .then(this.authorize.bind(this, params))
          .then(this.remove.bind(this, params))
          .then(function(code) {
            res.send(code);
          })
          .catch(function(err) {
            console.log(err);
            res.send(404);
          })
          .done();

        }.bind(this));

        return this;
    },

    listen: function (port) {
        this.pkg = this.app.get('pkg');
        this.app.listen(port);
        return this;
    },

    checkResult:function(pkg) {
      var deferred = Q.defer();

      if (pkg) {
        deferred.resolve();
      } else{
        deferred.reject();
      }

      return deferred.promise;
    },

    authorize:function(params) {
      var deferred = Q.defer();

      // check collaborators for the given repo
      this.checkCollaborators(params).then(function(code) {
        // user is a collaborator on the given repo
        deferred.resolve();
      })
      .catch(function(code) {
        // check if user is collaborator on framework
        params.url = 'https://api.github.com/repos/adaptlearning/adapt_framework/collaborators/'+params.username;
        this.checkCollaborators(params).then(function(code) {
          // user is a collaborator on the framework
          deferred.resolve();
        })
        .catch(function(code) {
          deferred.reject();
        })
        .done();
      }.bind(this))
      .done();

      return deferred.promise;
    },

    checkCollaborators:function(params) {
      var deferred = Q.defer();

      this.getCollaborators(params).then(function(res) {
        var code = res.statusCode;
        // GitHub returns 204 if user is collaborator
        if (code==204) return deferred.resolve(204);
        // follow a redirect if necessary
        if (code==301 || code==302 || code==307) {
          params.url = res.headers.location;
          this.checkCollaborators(params).then(function(code) {
            deferred.resolve(code);
          })
          .catch(function(code) {
            deferred.reject(code);
          });
        }
        // otherwise give up
        else return deferred.reject(code);
      }.bind(this))
      .catch(function(err) {
        console.log('checkCollaborators error', err);
        deferred.reject();
      })
      .done();

      return deferred.promise;
    },

    getCollaborators:function(params) {
      var deferred = Q.defer();

      request({
        url: params.url,
        method:'GET',
        headers: {'Authorization':'token '+params.auth_token, 'User-Agent':params.owner},
        followRedirect:false
      }, function(err, res, body) {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve(res);
        }
      });

      return deferred.promise;
    },

    remove:function(params) {
      return this.pkg.destroy({where: ["name = ?", params.pluginName]}).then(function(count) {
        if (count > 0) {
          console.log('Successfully deleted package '+params.pluginName);
          return 204;
        } else {
          return 404;
        }
      });
    }
};

module.exports = Object.create(WebServer);
