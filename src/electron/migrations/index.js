const fs = require('fs');
const path = require('path');
const DB = require('better-sqlite3');

// A hacky "migration" script after bailing on Prisma and realiing
// better-sqlite3 is not compatible with knex yet :|
// https://github.com/knex/knex/issues/4511
// todo: real migrations, backup database while migrating
module.exports = function(dbUrl) {
  const db = DB(dbUrl);
  const migration1 = fs.readFileSync(path.join(__dirname, '/20211005142122.sql'), 'utf8');
  db.exec(migration1);
}
