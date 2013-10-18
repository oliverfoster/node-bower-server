var Sequelize = require("sequelize");
var _ = Sequelize.Utils._ ;

var Database = {
    init: function () {
        var match = process.env.DATABASE_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

        this.sequelize = new Sequelize(match[5], match[1], match[2], {
          dialect:  'postgres',
          protocol: 'postgres',
          port:     match[4],
          host:     match[3],
          logging:  true //false
        });
  
        this.Package = this.sequelize.define('Package',
          {
            name: {
              type: Sequelize.STRING,
              unique: true,
              allowNull: false
            },
            url: {
              type: Sequelize.STRING,
              unique: true,
              allowNull: false,
              validate: {
                isGitUrl: function(value) {
                  if (!value.match(/^git\:\/\//)) {
                    throw new Error('is not correct format');
                  }
                  return this;
                }
              }
            },
            hits: {
              type: Sequelize.INTEGER,
              defaultValue: 0
            }
          } , {
          instanceMethods: {
            hit: function () {
              this.hits += 1 ;
              this.save();
            }
          }
        });
        return this;
    },

    onSync: function () {
        var addIndex = this.sequelize.getQueryInterface().addIndex('Packages', ['name']);
        addIndex.error(function(e) {
          if(e.toString() !== 'error: relation "packages_name" already exists'){
            throw e;
          }
        });
    }
};

module.exports = Object.create(Database);
