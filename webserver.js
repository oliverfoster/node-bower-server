var express = require('express'),
    Q = require('q'),
    request = require('request'),
    util = require("util");

var WebServer = {
    init: function () {
        this.gh = {};
        this.checkedAdaptCollaborators = false;
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

        this.app.delete('/packages/:owner/:name/:username', function (req, res) {
          this.gh.owner = req.params.owner;
          this.gh.name = req.params.name;
          this.gh.username = req.params.username;
          this.gh.url = 'https://api.github.com/repos/'+req.params.owner+'/'+req.params.name+'/collaborators/'+req.params.owner;
          this.gh.auth_token = req.query.access_token;

          this.checkedAdaptCollaborators = false;

          this.pkg.find({where: ["name = ?", this.gh.name]})
          .then(this.checkResult.bind(this))
          .then(this.getCollaborators.bind(this))
          .then(this.checkCollaborators.bind(this))
          .then(this.remove.bind(this))
          .then(function(code) {
            res.send(code);
          })
          .catch(function(code) {
            res.send(code || 404);
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
    getCollaborators:function() {
      var deferred = Q.defer();

      request({
        url: this.gh.url,
        method:'GET',
        headers: {'Authorization':'token '+this.gh.auth_token, 'User-Agent':this.gh.owner}
      }, function(err, res, body) {
        /*console.log('getCollaborators:');
        console.log('err', err);
        console.log('res', res);
        console.log('body', body);*/
        if (err) {
          console.log('err', err);
          deferred.reject(403);
        } else {
          deferred.resolve({response:res, body:body});
        }
      });

      return deferred.promise;
    },
    checkCollaborators: function(collaborators) {
      var code = collaborators.response.statusCode;

      if (code == 204) {
        this.logCollaborator();
        return Q.resolve();
      }
      else if (code == 301 || code == 302 || code == 307) {
        this.redirect(collaborators.response.headers.location);
        return this.getCollaborators();
      }
      else if (code == 401 || code == 403) {
        return Q.reject(403);
      }
      else if (code == 404 && !this.checkedAdaptCollaborators) {
        this.tryAdaptCollaborators();
        return this.getCollaborators();
      }
      else {
        return Q.reject(404);
      }
    },
    remove:function() {
      return this.pkg.destroy({where: ["name = ?", this.gh.name]}).then(function(count) {
        if (count > 0) {
          console.log('Successfully deleted package');
          return 204;
        } else {
          return 404;
        }
      });
    },
    redirect:function(target) {
      this.logRedirect(target);
      this.gh.url = target;
    },
    tryAdaptCollaborators:function() {
      this.gh.url = 'https://api.github.com/repos/adaptlearning/adapt_framework/collaborators/'+this.gh.username;
      this.checkedAdaptCollaborators = true;
    },
    logCollaborator:function() {
      if (this.checkedAdaptCollaborators) {
        console.log(this.gh.username+' is a collaborator on adaptlearning/adapt_framework');
      } else {
        console.log(this.gh.username+' is a collaborator on '+this.gh.owner+'/'+this.gh.name);
      }
    },
    logRedirect:function(target) {
      console.log('Redirecting from '+this.gh.url+ ' to '+target);
    }
};

module.exports = Object.create(WebServer);
