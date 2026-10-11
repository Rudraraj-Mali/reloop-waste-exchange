const sql = require('mssql');
require('dotenv').config();

// Azure SQL Database configuration
const config = {
  user: process.env.DB_USER || 'azure_admin',
  password: process.env.DB_PASSWORD || 'YourStrongPassword123!',
  server: process.env.DB_SERVER || 'your-azure-sql-server.database.windows.net',
  database: process.env.DB_DATABASE || 'reloop_db',
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    // Azure SQL Database strictly requires encryption
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = null;

/**
 * Returns a singleton connection pool to Azure SQL Database.
 */
async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config)
      .then(pool => {
        console.log(`[Azure SQL] Connected successfully to database: ${config.database} on ${config.server}`);
        return pool;
      })
      .catch(err => {
        console.error('[Azure SQL] Connection Failed:', err.message);
        poolPromise = null; // Reset so next request can retry
        throw err;
      });
  }
  return poolPromise;
}

module.exports = {
  sql,
  getPool,
  config
};
