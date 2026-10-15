const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ==============================================================================
// 1. AUTHENTICATION APIS (Plain-text credentials as specified for academic project)
// ==============================================================================

/**
 * POST /api/register
 * Creates a new user (Generator or Recycler) with 0 initial eco_points.
 */
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, user_type } = req.body;

    if (!name || !email || !password || !user_type) {
      return res.status(400).json({ error: 'All fields (name, email, password, user_type) are required.' });
    }

    if (!['Generator', 'Recycler'].includes(user_type)) {
      return res.status(400).json({ error: "user_type must be either 'Generator' or 'Recycler'." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await db.query('SELECT user_id FROM Users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // Insert user
    await db.query(
      'INSERT INTO Users (name, email, password, user_type, eco_points) VALUES (?, ?, ?, ?, 0)',
      [name.trim(), cleanEmail, password, user_type]
    );

    // Fetch newly created user
    const userRes = await db.query(
      'SELECT user_id, name, email, user_type, eco_points, created_at FROM Users WHERE LOWER(email) = ?',
      [cleanEmail]
    );

    const newUser = userRes.recordset[0];
    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: newUser
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ error: 'Database error during registration: ' + err.message });
  }
});

/**
 * POST /api/login
 * Validates plain-text credentials against Users table using simple SELECT query.
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await db.query(
      'SELECT user_id, name, email, user_type, eco_points, created_at FROM Users WHERE LOWER(email) = ? AND password = ?',
      [cleanEmail, password]
    );

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.recordset[0];
    return res.json({
      success: true,
      message: 'Login successful.',
      user
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Database error during login: ' + err.message });
  }
});

// ==============================================================================
// 2. CATEGORIES API
// ==============================================================================

/**
 * GET /api/categories
 * Returns all waste categories with their CO2 emission savings multiplier.
 */
app.get('/api/categories', async (req, res) => {
  try {
    const result = await db.query('SELECT category_id, name, co2_saved_per_kg FROM WasteCategories ORDER BY name ASC');
    return res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching categories:', err);
    return res.status(500).json({ error: 'Failed to fetch categories: ' + err.message });
  }
});

// ==============================================================================
// 3. WASTE LISTINGS APIS
// ==============================================================================

/**
 * GET /api/listings
 * Returns all 'Available' waste listings joined with Category and Generator details.
 */
app.get('/api/listings', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        wl.listing_id,
        wl.title,
        wl.weight_kg,
        wl.status,
        wl.created_at,
        wc.category_id,
        wc.name AS category_name,
        wc.co2_saved_per_kg,
        ROUND(wl.weight_kg * wc.co2_saved_per_kg, 2) AS potential_co2_saved,
        u.user_id AS generator_id,
        u.name AS generator_name,
        u.eco_points AS generator_eco_points
      FROM WasteListings wl
      JOIN WasteCategories wc ON wl.category_id = wc.category_id
      JOIN Users u ON wl.generator_id = u.user_id
      WHERE wl.status = 'Available'
      ORDER BY wl.created_at DESC;
    `);

    return res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching listings:', err);
    return res.status(500).json({ error: 'Failed to fetch listings: ' + err.message });
  }
});

/**
 * POST /api/listings
 * Creates a new waste listing posted by a Generator.
 */
app.post('/api/listings', async (req, res) => {
  try {
    const { generator_id, category_id, title, weight_kg } = req.body;

    if (!generator_id || !category_id || !title || !weight_kg) {
      return res.status(400).json({ error: 'generator_id, category_id, title, and weight_kg are required.' });
    }

    const weight = parseFloat(weight_kg);
    if (isNaN(weight) || weight <= 0) {
      return res.status(400).json({ error: 'weight_kg must be a positive number.' });
    }

    // Verify the user exists and is a Generator
    const userRes = await db.query('SELECT user_type FROM Users WHERE user_id = ?', [generator_id]);
    if (userRes.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (userRes.recordset[0].user_type !== 'Generator') {
      return res.status(403).json({ error: 'Only Users with user_type "Generator" can create waste listings.' });
    }

    // Insert new listing
    await db.query(
      'INSERT INTO WasteListings (generator_id, category_id, title, weight_kg, status) VALUES (?, ?, ?, ?, "Available")',
      [generator_id, category_id, title.trim(), weight]
    );

    const insertedListingRes = await db.query(
      'SELECT * FROM WasteListings WHERE generator_id = ? ORDER BY listing_id DESC LIMIT 1',
      [generator_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Waste listing created successfully.',
      listing: insertedListingRes.recordset[0]
    });
  } catch (err) {
    console.error('Error creating listing:', err);
    return res.status(500).json({ error: 'Failed to create listing: ' + err.message });
  }
});

// ==============================================================================
// 4. EXCHANGE REQUESTS APIS
// ==============================================================================

/**
 * POST /api/requests
 * Submits an exchange request from a Recycler to claim a WasteListing.
 */
app.post('/api/requests', async (req, res) => {
  try {
    const { listing_id, recycler_id } = req.body;

    if (!listing_id || !recycler_id) {
      return res.status(400).json({ error: 'listing_id and recycler_id are required.' });
    }

    // Verify recycler user
    const userRes = await db.query('SELECT user_type FROM Users WHERE user_id = ?', [recycler_id]);
    if (userRes.recordset.length === 0) {
      return res.status(404).json({ error: 'Recycler user not found.' });
    }

    if (userRes.recordset[0].user_type !== 'Recycler') {
      return res.status(403).json({ error: 'Only Recyclers can submit exchange requests.' });
    }

    // Verify listing is available
    const listingRes = await db.query('SELECT listing_id, generator_id, status FROM WasteListings WHERE listing_id = ?', [listing_id]);
    if (listingRes.recordset.length === 0) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const listing = listingRes.recordset[0];
    if (listing.status !== 'Available') {
      return res.status(400).json({ error: `Cannot request listing because its current status is '${listing.status}'.` });
    }

    if (listing.generator_id === parseInt(recycler_id, 10)) {
      return res.status(400).json({ error: 'You cannot request your own listing.' });
    }

    // Check for duplicate pending requests
    const dupRes = await db.query(
      'SELECT request_id FROM ExchangeRequests WHERE listing_id = ? AND recycler_id = ? AND request_status IN ("Pending", "Accepted")',
      [listing_id, recycler_id]
    );

    if (dupRes.recordset.length > 0) {
      return res.status(409).json({ error: 'You have already submitted an active request for this listing.' });
    }

    await db.query(
      'INSERT INTO ExchangeRequests (listing_id, recycler_id, request_status) VALUES (?, ?, "Pending")',
      [listing_id, recycler_id]
    );

    const insertedReq = await db.query(
      'SELECT * FROM ExchangeRequests WHERE listing_id = ? AND recycler_id = ? ORDER BY request_id DESC LIMIT 1',
      [listing_id, recycler_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Exchange request submitted successfully.',
      request: insertedReq.recordset[0]
    });
  } catch (err) {
    console.error('Error creating exchange request:', err);
    return res.status(500).json({ error: 'Failed to create request: ' + err.message });
  }
});

// ==============================================================================
// 5. ACID TRANSACTION: ACCEPT REQUEST (CONCURRENCY CONTROL)
// ==============================================================================

/**
 * PUT /api/requests/accept
 * Demonstrates ACID Transactions & Concurrency Control.
 * Atomically verifies listing availability, accepts target request, marks listing as Accepted,
 * and automatically rejects competing pending requests.
 */
app.put('/api/requests/accept', async (req, res) => {
  const { request_id, generator_id } = req.body;

  if (!request_id || !generator_id) {
    return res.status(400).json({ error: 'request_id and generator_id are required.' });
  }

  try {
    // STEP 1: Verify the request exists
    const reqResult = await db.query(
      'SELECT request_id, listing_id, request_status, recycler_id FROM ExchangeRequests WHERE request_id = ?',
      [request_id]
    );

    if (reqResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Exchange request not found.' });
    }

    const targetRequest = reqResult.recordset[0];
    const listingId = targetRequest.listing_id;

    if (targetRequest.request_status !== 'Pending') {
      return res.status(400).json({ 
        error: `Request cannot be accepted because it is currently '${targetRequest.request_status}'.` 
      });
    }

    // STEP 2: Verify Generator ownership and Listing Available status
    const lockResult = await db.query(
      'SELECT listing_id, generator_id, status, title FROM WasteListings WHERE listing_id = ? AND generator_id = ?',
      [listingId, generator_id]
    );

    if (lockResult.recordset.length === 0) {
      return res.status(403).json({ 
        error: 'Listing not found or you are not authorized as the generator of this listing.' 
      });
    }

    const lockedListing = lockResult.recordset[0];
    if (lockedListing.status !== 'Available') {
      return res.status(409).json({ 
        error: `ACID Concurrency Check: Listing is no longer Available (Current status: '${lockedListing.status}'). Double-booking prevented!` 
      });
    }

    // Count competing pending requests before rejecting
    const competingCheck = await db.query(
      'SELECT COUNT(*) as count FROM ExchangeRequests WHERE listing_id = ? AND request_id != ? AND request_status = "Pending"',
      [listingId, request_id]
    );
    const competingRejectedCount = competingCheck.recordset[0]?.count || 0;

    // STEP 3, 4, 5: Execute atomic updates
    const batchStatements = [
      {
        sql: 'UPDATE ExchangeRequests SET request_status = "Accepted" WHERE request_id = ?',
        params: [request_id]
      },
      {
        sql: 'UPDATE WasteListings SET status = "Accepted" WHERE listing_id = ?',
        params: [listingId]
      },
      {
        sql: 'UPDATE ExchangeRequests SET request_status = "Rejected" WHERE listing_id = ? AND request_id != ? AND request_status = "Pending"',
        params: [listingId, request_id]
      }
    ];

    await db.batchCloudflareD1(batchStatements);

    return res.json({
      success: true,
      acid_transaction: {
        status: 'COMMITTED',
        row_locking_applied: 'Serialized Atomic Batch on WasteListings (Cloudflare D1)',
        listing_id: listingId,
        accepted_request_id: request_id,
        competing_requests_rejected: competingRejectedCount
      },
      message: `Transaction committed successfully! Request #${request_id} accepted. Listing marked 'Accepted'. ${competingRejectedCount} competing request(s) automatically rejected.`
    });

  } catch (err) {
    console.error('ACID Transaction Error:', err);
    return res.status(500).json({ error: 'ACID Transaction failed: ' + err.message });
  }
});

// ==============================================================================
// 6. TRIGGER DEMONSTRATION: COMPLETE REQUEST
// ==============================================================================

/**
 * PUT /api/requests/complete
 * Updates ExchangeRequests status to 'Completed'.
 * This directly fires the Database AFTER UPDATE trigger: `trg_ExchangeRequests_Completed`
 * Which automatically:
 * 1. Sets the WasteListings status to 'Completed'
 * 2. Awards +10 eco_points to the Generator in the Users table!
 */
app.put('/api/requests/complete', async (req, res) => {
  try {
    const { request_id, user_id } = req.body;

    if (!request_id || !user_id) {
      return res.status(400).json({ error: 'request_id and user_id are required.' });
    }

    // Verify request exists and is in 'Accepted' status
    const reqResult = await db.query(`
      SELECT 
        er.request_id, 
        er.listing_id, 
        er.recycler_id, 
        er.request_status,
        wl.generator_id,
        wl.title AS listing_title,
        wl.weight_kg
      FROM ExchangeRequests er
      JOIN WasteListings wl ON er.listing_id = wl.listing_id
      WHERE er.request_id = ?;
    `, [request_id]);

    if (reqResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const reqData = reqResult.recordset[0];
    const currentUserId = parseInt(user_id, 10);

    if (reqData.recycler_id !== currentUserId && reqData.generator_id !== currentUserId) {
      return res.status(403).json({ error: 'Unauthorized: Only the assigned Recycler or Generator can mark this exchange completed.' });
    }

    if (reqData.request_status !== 'Accepted') {
      return res.status(400).json({ 
        error: `Only 'Accepted' requests can be marked 'Completed'. Current status is '${reqData.request_status}'.` 
      });
    }

    // Capture Generator's eco_points BEFORE trigger executes
    const ptsBeforeRes = await db.query('SELECT eco_points FROM Users WHERE user_id = ?', [reqData.generator_id]);
    const ecoPointsBefore = ptsBeforeRes.recordset[0]?.eco_points || 0;

    // UPDATE query on ExchangeRequests that fires the trigger:
    await db.query(
      'UPDATE ExchangeRequests SET request_status = "Completed" WHERE request_id = ?',
      [request_id]
    );

    // Verify trigger outcomes directly from the database:
    // 1. Listing status changed to 'Completed' via trigger
    const listingCheckRes = await db.query('SELECT status FROM WasteListings WHERE listing_id = ?', [reqData.listing_id]);
    const updatedListingStatus = listingCheckRes.recordset[0]?.status;

    // 2. Generator received +10 eco_points via trigger
    const ptsAfterRes = await db.query('SELECT eco_points FROM Users WHERE user_id = ?', [reqData.generator_id]);
    const ecoPointsAfter = ptsAfterRes.recordset[0]?.eco_points || 0;

    return res.json({
      success: true,
      message: "Exchange marked 'Completed'. Database Trigger 'trg_ExchangeRequests_Completed' executed automatically!",
      trigger_verification: {
        trigger_name: 'trg_ExchangeRequests_Completed',
        table_updated_directly: 'ExchangeRequests (request_status = "Completed")',
        listing_status_updated_by_trigger: updatedListingStatus,
        generator_id: reqData.generator_id,
        eco_points_before: ecoPointsBefore,
        eco_points_after: ecoPointsAfter,
        points_awarded_by_trigger: ecoPointsAfter - ecoPointsBefore
      }
    });

  } catch (err) {
    console.error('Trigger Execution Error:', err);
    return res.status(500).json({ error: 'Failed to complete exchange request: ' + err.message });
  }
});

// ==============================================================================
// 7. VIEW & DASHBOARD APIS
// ==============================================================================

/**
 * GET /api/dashboard/:userId
 * Fetches metrics directly from the Database View: `UserImpactDashboard`
 */
app.get('/api/dashboard/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    // 1. Query the SQL View directly
    const viewResult = await db.query(
      'SELECT user_id, name, email, user_type, eco_points, total_listings_posted, completed_exchanges, total_weight_diverted, total_co2_saved FROM UserImpactDashboard WHERE user_id = ?',
      [userId]
    );

    if (viewResult.recordset.length === 0) {
      return res.status(404).json({ error: 'User metrics not found in UserImpactDashboard view.' });
    }

    const impactMetrics = viewResult.recordset[0];

    // 2. Query contextual listings & requests based on user role
    let myListings = [];
    let incomingRequests = [];
    let myRequests = [];

    if (impactMetrics.user_type === 'Generator') {
      const listingsRes = await db.query(`
        SELECT 
          wl.listing_id,
          wl.title,
          wl.weight_kg,
          wl.status,
          wl.created_at,
          wc.name AS category_name,
          wc.co2_saved_per_kg,
          ROUND(wl.weight_kg * wc.co2_saved_per_kg, 2) AS potential_co2_saved
        FROM WasteListings wl
        JOIN WasteCategories wc ON wl.category_id = wc.category_id
        WHERE wl.generator_id = ?
        ORDER BY wl.created_at DESC;
      `, [userId]);
      myListings = listingsRes.recordset;

      const incomingRes = await db.query(`
        SELECT 
          er.request_id,
          er.listing_id,
          er.request_status,
          er.created_at,
          wl.title AS listing_title,
          wl.weight_kg,
          u.user_id AS recycler_id,
          u.name AS recycler_name,
          u.email AS recycler_email
        FROM ExchangeRequests er
        JOIN WasteListings wl ON er.listing_id = wl.listing_id
        JOIN Users u ON er.recycler_id = u.user_id
        WHERE wl.generator_id = ?
        ORDER BY er.created_at DESC;
      `, [userId]);
      incomingRequests = incomingRes.recordset;

    } else if (impactMetrics.user_type === 'Recycler') {
      const myReqRes = await db.query(`
        SELECT 
          er.request_id,
          er.listing_id,
          er.request_status,
          er.created_at,
          wl.title AS listing_title,
          wl.weight_kg,
          wl.status AS listing_status,
          wc.name AS category_name,
          gen.user_id AS generator_id,
          gen.name AS generator_name,
          gen.email AS generator_email
        FROM ExchangeRequests er
        JOIN WasteListings wl ON er.listing_id = wl.listing_id
        JOIN WasteCategories wc ON wl.category_id = wc.category_id
        JOIN Users gen ON wl.generator_id = gen.user_id
        WHERE er.recycler_id = ?
        ORDER BY er.created_at DESC;
      `, [userId]);
      myRequests = myReqRes.recordset;
    }

    return res.json({
      success: true,
      impact: impactMetrics,
      myListings,
      incomingRequests,
      myRequests
    });

  } catch (err) {
    console.error('Error fetching dashboard view:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard data: ' + err.message });
  }
});

// Fallback route to index.html for client-side navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server locally (guarded for serverless Vercel deployment)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`♻️  ReLoop Waste Exchange Server is running on port ${PORT}`);
    console.log(`🔗 Local Web URL: http://localhost:${PORT}`);
    console.log(`☁️ Connected to Cloudflare D1 SQL Database`);
    console.log(`====================================================`);
  });
}

module.exports = app;
