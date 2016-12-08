var database = require('./database').init();
var webserver = require('./webserver').init();

var sync = database.Package.sync().then( function () {
    return database.onSync.bind(database);
}).then(function () {
    webserver.app.set('pkg', database.Package);
    webserver.listen(process.env.PORT || 5000);
});