var Sequelize = require("sequelize");
var _ = Sequelize.Utils._ ;

var Database = {
    init: function () {
        console.log(process.end);
        
        var match = process.env.DATABASE_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

        var options = {
          dialect:  'postgres',
          protocol: 'postgres',
          port:     match[4],
          host:     match[3],
          dialectOptions: {
              ssl: true
          }
        };
        
        console.log('Connection:', process.env.DATABASE_URL, match);

        this.sequelize = new Sequelize(match[5], match[1], match[2], options);
  
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
            },
            rename: function(newName) {
              this.name = newName;
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
        return this;
    }
};

module.exports = Object.create(Database);
