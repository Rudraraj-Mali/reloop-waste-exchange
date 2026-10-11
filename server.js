const express = require('express');
const cors = require('cors');
const path = require('path');
const { sql, getPool } = require('./db');

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

    const pool = await getPool();
    const checkReq = pool.request();
    checkReq.input('email', sql.NVarChar(150), email.trim().toLowerCase());
    const existing = await checkReq.query('SELECT user_id FROM Users WHERE email = @email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const insertReq = pool.request();
    insertReq.input('name', sql.NVarChar(100), name.trim());
    insertReq.input('email', sql.NVarChar(150), email.trim().toLowerCase());
    insertReq.input('password', sql.NVarChar(255), password); // Plain-text as specified
    insertReq.input('user_type', sql.NVarChar(20), user_type);

    const result = await insertReq.query(`
      INSERT INTO Users (name, email, password, user_type, eco_points)
      OUTPUT INSERTED.user_id, INSERTED.name, INSERTED.email, INSERTED.user_type, INSERTED.eco_points
      VALUES (@name, @email, @password, @user_type, 0);
    `);

    const newUser = result.recordset[0];
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

    const pool = await getPool();
    const request = pool.request();
    request.input('email', sql.NVarChar(150), email.trim().toLowerCase());
    request.input('password', sql.NVarChar(255), password);

    // Simple plain-text check as per assignment instructions
    const result = await request.query(`
      SELECT user_id, name, email, user_type, eco_points, created_at
      FROM Users
      WHERE email = @email AND password = @password;
    `);

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
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT category_id, name, co2_saved_per_kg
      FROM WasteCategories
      ORDER BY name ASC;
    `);
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
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        wl.listing_id,
        wl.title,
        wl.weight_kg,
        wl.status,
        wl.created_at,
        wc.category_id,
        wc.name AS category_name,
        wc.co2_saved_per_kg,
        CAST((wl.weight_kg * wc.co2_saved_per_kg) AS DECIMAL(10,2)) AS potential_co2_saved,
        u.user_id AS generator_id,
        u.name AS generator_name,
        u.eco_points AS generator_eco_points
      FROM WasteListings wl
      INNER JOIN WasteCategories wc ON wl.category_id = wc.category_id
      INNER JOIN Users u ON wl.generator_id = u.user_id
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

    const pool = await getPool();

    // Verify the user exists and is a Generator
    const userReq = pool.request();
    userReq.input('userId', sql.Int, generator_id);
    const userRes = await userReq.query('SELECT user_type FROM Users WHERE user_id = @userId');

    if (userRes.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (userRes.recordset[0].user_type !== 'Generator') {
      return res.status(403).json({ error: 'Only Users with user_type "Generator" can create waste listings.' });
    }

    const insertReq = pool.request();
    insertReq.input('generator_id', sql.Int, generator_id);
    insertReq.input('category_id', sql.Int, category_id);
    insertReq.input('title', sql.NVarChar(200), title.trim());
    insertReq.input('weight_kg', sql.Decimal(10, 2), weight);

    const result = await insertReq.query(`
      INSERT INTO WasteListings (generator_id, category_id, title, weight_kg, status)
      OUTPUT INSERTED.listing_id, INSERTED.generator_id, INSERTED.category_id, INSERTED.title, INSERTED.weight_kg, INSERTED.status, INSERTED.created_at
      VALUES (@generator_id, @category_id, @title, @weight_kg, 'Available');
    `);

    return res.status(201).json({
      success: true,
      message: 'Waste listing created successfully.',
      listing: result.recordset[0]
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

    const pool = await getPool();

    // Verify recycler user
    const userReq = pool.request();
    userReq.input('userId', sql.Int, recycler_id);
    const userRes = await userReq.query('SELECT user_type FROM Users WHERE user_id = @userId');

    if (userRes.recordset.length === 0) {
      return res.status(404).json({ error: 'Recycler user not found.' });
    }

    if (userRes.recordset[0].user_type !== 'Recycler') {
      return res.status(403).json({ error: 'Only Recyclers can submit exchange requests.' });
    }

    // Verify listing is available
    const listingReq = pool.request();
    listingReq.input('listingId', sql.Int, listing_id);
    const listingRes = await listingReq.query('SELECT listing_id, generator_id, status FROM WasteListings WHERE listing_id = @listingId');

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

    // Check for duplicate pending requests by same recycler
    const dupReq = pool.request();
    dupReq.input('listingId', sql.Int, listing_id);
    dupReq.input('recyclerId', sql.Int, recycler_id);
    const dupRes = await dupReq.query(`
      SELECT request_id 
      FROM ExchangeRequests 
      WHERE listing_id = @listingId AND recycler_id = @recyclerId AND request_status IN ('Pending', 'Accepted');
    `);

    if (dupRes.recordset.length > 0) {
      return res.status(409).json({ error: 'You have already submitted an active request for this listing.' });
    }

    const insertReq = pool.request();
    insertReq.input('listing_id', sql.Int, listing_id);
    insertReq.input('recycler_id', sql.Int, recycler_id);

    const result = await insertReq.query(`
      INSERT INTO ExchangeRequests (listing_id, recycler_id, request_status)
      OUTPUT INSERTED.request_id, INSERTED.listing_id, INSERTED.recycler_id, INSERTED.request_status, INSERTED.created_at
      VALUES (@listing_id, @recycler_id, 'Pending');
    `);

    return res.status(201).json({
      success: true,
      message: 'Exchange request submitted successfully.',
      request: result.recordset[0]
    });
  } catch (err) {
    console.error('Error creating exchange request:', err);
    return res.status(500).json({ error: 'Failed to create request: ' + err.message });
  }
});

// ==============================================================================
// 5. ACID TRANSACTION: ACCEPT REQUEST (WITH ROW LOCKING)
// ==============================================================================

/**
 * PUT /api/requests/accept
 * Demonstrates ACID Transactions with ROW LOCKING.
 * Locks the WasteListings row using UPDLOCK & ROWLOCK hints to guarantee
 * that no concurrent requests can double-book the listing.
 * 
 * Atomicity: All 3 updates succeed or entire transaction is rolled back.
 * Consistency: Preserves table constraints and status invariants.
 * Isolation: Row locking prevents race conditions and phantom updates.
 * Durability: Committed changes are permanently written to Azure SQL.
 */
app.put('/api/requests/accept', async (req, res) => {
  const { request_id, generator_id } = req.body;

  if (!request_id || !generator_id) {
    return res.status(400).json({ error: 'request_id and generator_id are required.' });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    // Begin ACID transaction with Repeatable Read or Read Committed isolation
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    // STEP 1: Verify the request exists and fetch listing reference
    const reqInspect = new sql.Request(transaction);
    reqInspect.input('requestId', sql.Int, request_id);
    const reqResult = await reqInspect.query(`
      SELECT request_id, listing_id, request_status, recycler_id
      FROM ExchangeRequests
      WHERE request_id = @requestId;
    `);

    if (reqResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Exchange request not found.' });
    }

    const targetRequest = reqResult.recordset[0];
    const listingId = targetRequest.listing_id;

    if (targetRequest.request_status !== 'Pending') {
      await transaction.rollback();
      return res.status(400).json({ 
        error: `Request cannot be accepted because it is currently '${targetRequest.request_status}'.` 
      });
    }

    // STEP 2: ROW LOCKING MECHANISM
    // Use UPDLOCK and ROWLOCK hints on WasteListings.
    // This locks the specific listing row until transaction commits/rolls back,
    // immediately preventing any concurrent thread or request from double-booking!
    const lockListingReq = new sql.Request(transaction);
    lockListingReq.input('listingId', sql.Int, listingId);
    lockListingReq.input('generatorId', sql.Int, generator_id);

    const lockResult = await lockListingReq.query(`
      SELECT listing_id, generator_id, status, title
      FROM WasteListings WITH (UPDLOCK, ROWLOCK)
      WHERE listing_id = @listingId AND generator_id = @generatorId;
    `);

    if (lockResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(403).json({ 
        error: 'Listing not found or you are not authorized as the generator of this listing.' 
      });
    }

    const lockedListing = lockResult.recordset[0];

    // Check if listing has already been accepted/completed by a concurrent transaction
    if (lockedListing.status !== 'Available') {
      await transaction.rollback();
      return res.status(409).json({ 
        error: `ACID Concurrency Check: Listing is no longer Available (Current status: '${lockedListing.status}'). Double-booking prevented!` 
      });
    }

    // STEP 3: Accept the target ExchangeRequest
    const updateTargetReq = new sql.Request(transaction);
    updateTargetReq.input('requestId', sql.Int, request_id);
    await updateTargetReq.query(`
      UPDATE ExchangeRequests
      SET request_status = 'Accepted'
      WHERE request_id = @requestId;
    `);

    // STEP 4: Update the WasteListing status to 'Accepted'
    const updateListingReq = new sql.Request(transaction);
    updateListingReq.input('listingId', sql.Int, listingId);
    await updateListingReq.query(`
      UPDATE WasteListings
      SET status = 'Accepted'
      WHERE listing_id = @listingId;
    `);

    // STEP 5: Automatically REJECT all other competing pending requests for this listing
    const rejectOthersReq = new sql.Request(transaction);
    rejectOthersReq.input('listingId', sql.Int, listingId);
    rejectOthersReq.input('requestId', sql.Int, request_id);
    const rejectResult = await rejectOthersReq.query(`
      UPDATE ExchangeRequests
      SET request_status = 'Rejected'
      WHERE listing_id = @listingId 
        AND request_id <> @requestId 
        AND request_status = 'Pending';
    `);

    const competingRejectedCount = rejectResult.rowsAffected[0] || 0;

    // STEP 6: COMMIT TRANSACTION
    await transaction.commit();

    return res.json({
      success: true,
      acid_transaction: {
        status: 'COMMITTED',
        row_locking_applied: 'UPDLOCK, ROWLOCK on WasteListings',
        listing_id: listingId,
        accepted_request_id: request_id,
        competing_requests_rejected: competingRejectedCount
      },
      message: `Transaction committed successfully! Request #${request_id} accepted. Listing status marked 'Accepted'. ${competingRejectedCount} other pending request(s) automatically rejected.`
    });

  } catch (err) {
    console.error('ACID Transaction Error:', err);
    try {
      await transaction.rollback();
    } catch (rbErr) {
      console.error('Rollback Error:', rbErr);
    }
    return res.status(500).json({ error: 'ACID Transaction failed and rolled back: ' + err.message });
  }
});

// ==============================================================================
// 6. TRIGGER DEMONSTRATION: COMPLETE REQUEST
// ==============================================================================

/**
 * PUT /api/requests/complete
 * Updates ExchangeRequests status to 'Completed'.
 * This directly fires the Azure SQL AFTER UPDATE trigger: `trg_ExchangeRequests_Completed`
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

    const pool = await getPool();

    // Verify request exists and is in 'Accepted' status
    const reqCheck = pool.request();
    reqCheck.input('requestId', sql.Int, request_id);
    const reqResult = await reqCheck.query(`
      SELECT 
        er.request_id, 
        er.listing_id, 
        er.recycler_id, 
        er.request_status,
        wl.generator_id,
        wl.title AS listing_title,
        wl.weight_kg
      FROM ExchangeRequests er
      INNER JOIN WasteListings wl ON er.listing_id = wl.listing_id
      WHERE er.request_id = @requestId;
    `);

    if (reqResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const reqData = reqResult.recordset[0];

    // Either the Recycler who picked up or the Generator can mark it completed
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
    const ptsBeforeReq = pool.request();
    ptsBeforeReq.input('genId', sql.Int, reqData.generator_id);
    const ptsBeforeRes = await ptsBeforeReq.query('SELECT eco_points FROM Users WHERE user_id = @genId');
    const ecoPointsBefore = ptsBeforeRes.recordset[0]?.eco_points || 0;

    // UPDATE query on ExchangeRequests that fires the trigger:
    const updateReq = pool.request();
    updateReq.input('requestId', sql.Int, request_id);
    await updateReq.query(`
      UPDATE ExchangeRequests
      SET request_status = 'Completed'
      WHERE request_id = @requestId;
    `);

    // Verify trigger outcomes in database:
    // 1. Listing status changed to 'Completed'
    const listingCheck = pool.request();
    listingCheck.input('listingId', sql.Int, reqData.listing_id);
    const listingCheckRes = await listingCheck.query('SELECT status FROM WasteListings WHERE listing_id = @listingId');
    const updatedListingStatus = listingCheckRes.recordset[0]?.status;

    // 2. Generator received +10 eco_points
    const ptsAfterReq = pool.request();
    ptsAfterReq.input('genId', sql.Int, reqData.generator_id);
    const ptsAfterRes = await ptsAfterReq.query('SELECT eco_points FROM Users WHERE user_id = @genId');
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
 * Fetches metrics directly from the Azure SQL View: `UserImpactDashboard`
 * Returns total weight diverted, total CO2 saved, total eco points, and active listings/requests.
 */
app.get('/api/dashboard/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    const pool = await getPool();

    // 1. Query the SQL View directly
    const viewReq = pool.request();
    viewReq.input('userId', sql.Int, userId);
    const viewResult = await viewReq.query(`
      SELECT 
        user_id,
        name,
        email,
        user_type,
        eco_points,
        total_listings_posted,
        completed_exchanges,
        total_weight_diverted,
        total_co2_saved
      FROM UserImpactDashboard
      WHERE user_id = @userId;
    `);

    if (viewResult.recordset.length === 0) {
      return res.status(404).json({ error: 'User metrics not found in UserImpactDashboard view.' });
    }

    const impactMetrics = viewResult.recordset[0];

    // 2. Query contextual listings & requests based on user role
    let myListings = [];
    let incomingRequests = [];
    let myRequests = [];

    if (impactMetrics.user_type === 'Generator') {
      // Fetch all listings created by this generator
      const listingsReq = pool.request();
      listingsReq.input('userId', sql.Int, userId);
      const listingsRes = await listingsReq.query(`
        SELECT 
          wl.listing_id,
          wl.title,
          wl.weight_kg,
          wl.status,
          wl.created_at,
          wc.name AS category_name,
          wc.co2_saved_per_kg,
          CAST((wl.weight_kg * wc.co2_saved_per_kg) AS DECIMAL(10,2)) AS potential_co2_saved
        FROM WasteListings wl
        INNER JOIN WasteCategories wc ON wl.category_id = wc.category_id
        WHERE wl.generator_id = @userId
        ORDER BY wl.created_at DESC;
      `);
      myListings = listingsRes.recordset;

      // Fetch incoming requests for the generator's listings
      const incomingReq = pool.request();
      incomingReq.input('userId', sql.Int, userId);
      const incomingRes = await incomingReq.query(`
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
        INNER JOIN WasteListings wl ON er.listing_id = wl.listing_id
        INNER JOIN Users u ON er.recycler_id = u.user_id
        WHERE wl.generator_id = @userId
        ORDER BY er.created_at DESC;
      `);
      incomingRequests = incomingRes.recordset;

    } else if (impactMetrics.user_type === 'Recycler') {
      // Fetch all requests submitted by this recycler
      const myReqQuery = pool.request();
      myReqQuery.input('userId', sql.Int, userId);
      const myReqRes = await myReqQuery.query(`
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
        INNER JOIN WasteListings wl ON er.listing_id = wl.listing_id
        INNER JOIN WasteCategories wc ON wl.category_id = wc.category_id
        INNER JOIN Users gen ON wl.generator_id = gen.user_id
        WHERE er.recycler_id = @userId
        ORDER BY er.created_at DESC;
      `);
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
    console.log(`====================================================`);
  });
}

module.exports = app;

