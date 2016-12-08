var database = require('./database').init();
var webserver = require('./webserver').init();

var sync = database.Package.sync().then( function () {
    database.onSync.bind(database);
}).then(function () {
    webserver.app.set('pkg', pkg);
    webserver.listen(process.env.PORT || 5000);
});