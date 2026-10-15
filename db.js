require('dotenv').config();

const CF_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CF_EMAIL = process.env.CLOUDFLARE_EMAIL;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;

const isCloudflare = Boolean(CF_API_KEY && CF_DATABASE_ID);

/**
 * Cloudflare D1 SQL query executor via official Cloudflare REST API.
 */
async function queryCloudflareD1(sql, params = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`;

  const headers = {
    'Content-Type': 'application/json'
  };

  // Support both Global API Keys (cfk_...) and API Tokens
  if (CF_API_KEY.startsWith('cfk_') || CF_EMAIL) {
    headers['X-Auth-Key'] = CF_API_KEY;
    if (CF_EMAIL) headers['X-Auth-Email'] = CF_EMAIL;
  } else {
    headers['Authorization'] = `Bearer ${CF_API_KEY}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sql, params })
  });

  const data = await response.json();
  if (!data.success) {
    const errorMsg = data.errors?.map(e => e.message).join(' | ') || 'Cloudflare D1 query failed';
    throw new Error(errorMsg);
  }

  const firstResult = data.result?.[0] || {};
  return {
    recordset: firstResult.results || [],
    rowsAffected: [firstResult.meta?.changes || 0],
    meta: firstResult.meta
  };
}

/**
 * Execute multiple statements in batch on Cloudflare D1.
 */
async function batchCloudflareD1(statements) {
  // Execute sequentially or combined
  const results = [];
  for (const stmt of statements) {
    const res = await queryCloudflareD1(stmt.sql, stmt.params || []);
    results.push(res);
  }
  return results;
}

// Fallback for Azure SQL
let mssql = null;
let mssqlPool = null;

async function queryAzureSQL(sqlQuery, params = {}) {
  if (!mssql) {
    mssql = require('mssql');
  }

  if (!mssqlPool) {
    mssqlPool = await mssql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE,
      port: parseInt(process.env.DB_PORT, 10) || 1433,
      options: {
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
      }
    });
  }

  const req = mssqlPool.request();
  for (const [key, val] of Object.entries(params)) {
    req.input(key, val);
  }
  return await req.query(sqlQuery);
}

/**
 * Universal query function:
 * Defaults to Cloudflare D1 SQL when credentials exist, otherwise falls back to Azure SQL.
 */
async function query(sql, params = []) {
  if (isCloudflare) {
    return await queryCloudflareD1(sql, params);
  }
  return await queryAzureSQL(sql, params);
}

module.exports = {
  isCloudflare,
  query,
  queryCloudflareD1,
  batchCloudflareD1
};
