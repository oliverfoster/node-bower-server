var database = require('./database').init();
var webserver = require('./webserver').init();

var sync = database.Package.sync().then( function () {
    return database.onSync.bind(database);
}).then(function (db) {
    webserver.app.set('pkg', db.Package);
    webserver.listen(process.env.PORT || 5000);
});