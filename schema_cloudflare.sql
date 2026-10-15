-- ==============================================================================
-- ReLoop: Waste Exchange & Recycling Marketplace
-- Cloudflare D1 SQL DDL & Schema Script
-- Demonstrating Advanced DBMS Concepts: ACID Transactions, Triggers & Views
-- ==============================================================================

-- 1. DROP EXISTING OBJECTS
DROP TRIGGER IF EXISTS trg_ExchangeRequests_Completed;
DROP VIEW IF EXISTS UserImpactDashboard;
DROP TABLE IF EXISTS ExchangeRequests;
DROP TABLE IF EXISTS WasteListings;
DROP TABLE IF EXISTS WasteCategories;
DROP TABLE IF EXISTS Users;

-- 2. CREATE TABLES
-- 2.1 Users Table
CREATE TABLE Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, -- Plain-text password per academic specification
    user_type TEXT NOT NULL CHECK (user_type IN ('Generator', 'Recycler')),
    eco_points INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 WasteCategories Table
CREATE TABLE WasteCategories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    co2_saved_per_kg REAL NOT NULL CHECK (co2_saved_per_kg >= 0)
);

-- 2.3 WasteListings Table
CREATE TABLE WasteListings (
    listing_id INTEGER PRIMARY KEY AUTOINCREMENT,
    generator_id INTEGER NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES WasteCategories(category_id),
    title TEXT NOT NULL,
    weight_kg REAL NOT NULL CHECK (weight_kg > 0),
    status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Accepted', 'Completed', 'Cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2.4 ExchangeRequests Table
CREATE TABLE ExchangeRequests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES WasteListings(listing_id) ON DELETE CASCADE,
    recycler_id INTEGER NOT NULL REFERENCES Users(user_id),
    request_status TEXT NOT NULL DEFAULT 'Pending' CHECK (request_status IN ('Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. TRIGGER IMPLEMENTATION
-- When an ExchangeRequest becomes 'Completed', automatically:
-- 1. Sets the WasteListings status to 'Completed'
-- 2. Adds 10 eco_points to the Generator's user record
CREATE TRIGGER trg_ExchangeRequests_Completed
AFTER UPDATE OF request_status ON ExchangeRequests
WHEN NEW.request_status = 'Completed' AND OLD.request_status != 'Completed'
BEGIN
    UPDATE WasteListings
    SET status = 'Completed'
    WHERE listing_id = NEW.listing_id;

    UPDATE Users
    SET eco_points = eco_points + 10
    WHERE user_id = (SELECT generator_id FROM WasteListings WHERE listing_id = NEW.listing_id);
END;

-- 4. VIEW IMPLEMENTATION
-- Joins Users, Listings, Requests, and Categories to calculate total weight diverted and CO2 saved per user
CREATE VIEW UserImpactDashboard AS
WITH UserCompletedActivity AS (
    SELECT 
        wl.generator_id AS user_id,
        wl.weight_kg,
        (wl.weight_kg * wc.co2_saved_per_kg) AS co2_saved,
        1 AS is_exchange
    FROM WasteListings wl
    JOIN WasteCategories wc ON wl.category_id = wc.category_id
    WHERE wl.status = 'Completed'

    UNION ALL

    SELECT 
        er.recycler_id AS user_id,
        wl.weight_kg,
        (wl.weight_kg * wc.co2_saved_per_kg) AS co2_saved,
        1 AS is_exchange
    FROM ExchangeRequests er
    JOIN WasteListings wl ON er.listing_id = wl.listing_id
    JOIN WasteCategories wc ON wl.category_id = wc.category_id
    WHERE er.request_status = 'Completed'
),
AggregatedImpact AS (
    SELECT 
        user_id,
        SUM(weight_kg) AS total_weight_diverted,
        SUM(co2_saved) AS total_co2_saved,
        COUNT(is_exchange) AS completed_exchanges
    FROM UserCompletedActivity
    GROUP BY user_id
),
ListingsSummary AS (
    SELECT 
        generator_id AS user_id,
        COUNT(*) AS total_listings_posted
    FROM WasteListings
    GROUP BY generator_id
)
SELECT 
    u.user_id,
    u.name,
    u.email,
    u.user_type,
    u.eco_points,
    COALESCE(ls.total_listings_posted, 0) AS total_listings_posted,
    COALESCE(ai.completed_exchanges, 0) AS completed_exchanges,
    ROUND(COALESCE(ai.total_weight_diverted, 0), 2) AS total_weight_diverted,
    ROUND(COALESCE(ai.total_co2_saved, 0), 2) AS total_co2_saved
FROM Users u
LEFT JOIN AggregatedImpact ai ON u.user_id = ai.user_id
LEFT JOIN ListingsSummary ls ON u.user_id = ls.user_id;

-- 5. SEED DATA
INSERT INTO WasteCategories (name, co2_saved_per_kg) VALUES
('Plastic (PET / HDPE)', 1.50),
('Paper & Cardboard', 1.10),
('Metals (Aluminum & Steel)', 4.00),
('Glass', 0.30),
('E-Waste (Electronics)', 3.20),
('Organic Waste', 0.50);

INSERT INTO Users (name, email, password, user_type, eco_points) VALUES
('Alice Green (Cafe Owner)', 'alice@generator.com', 'password123', 'Generator', 20),
('Bob Clean (Urban Recycler)', 'bob@recycler.com', 'password123', 'Recycler', 0),
('Metro Supermarket', 'metro@generator.com', 'password123', 'Generator', 10),
('EcoPlast Recycling Ltd', 'ecoplast@recycler.com', 'password123', 'Recycler', 0);

INSERT INTO WasteListings (generator_id, category_id, title, weight_kg, status) VALUES
(1, 2, 'Bundled Cardboard Boxes (Flat Pack)', 45.00, 'Available'),
(1, 1, 'Clean HDPE Milk Jugs and PET Bottles', 20.00, 'Available'),
(3, 3, 'Scrap Aluminum Beverage Cans & Food Tins', 35.50, 'Available'),
(3, 6, 'Kitchen Vegetable & Fruit Scraps (Compost Grade)', 80.00, 'Completed');

INSERT INTO ExchangeRequests (listing_id, recycler_id, request_status) VALUES
(4, 2, 'Completed');
