-- ==============================================================================
-- ReLoop: Waste Exchange & Recycling Marketplace
-- Azure SQL Database (T-SQL) DDL & Schema Script
-- Demonstrating Advanced DBMS Concepts: ACID Transactions, Triggers & Views
-- ==============================================================================

-- 1. DROP EXISTING OBJECTS (IN REVERSE DEPENDENCY ORDER)
-- ==============================================================================
IF OBJECT_ID('dbo.trg_ExchangeRequests_Completed', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_ExchangeRequests_Completed;
GO

IF OBJECT_ID('dbo.UserImpactDashboard', 'V') IS NOT NULL
    DROP VIEW dbo.UserImpactDashboard;
GO

IF OBJECT_ID('dbo.sp_AcceptExchangeRequest', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_AcceptExchangeRequest;
GO

IF OBJECT_ID('dbo.ExchangeRequests', 'U') IS NOT NULL
    DROP TABLE dbo.ExchangeRequests;
GO

IF OBJECT_ID('dbo.WasteListings', 'U') IS NOT NULL
    DROP TABLE dbo.WasteListings;
GO

IF OBJECT_ID('dbo.WasteCategories', 'U') IS NOT NULL
    DROP TABLE dbo.WasteCategories;
GO

IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
    DROP TABLE dbo.Users;
GO

-- 2. CREATE TABLES
-- ==============================================================================

-- 2.1 Users Table
-- Stores user credentials in plain-text (as requested for academic simplicity),
-- user roles (Generator or Recycler), and accumulated eco_points.
CREATE TABLE Users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(150) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL, -- Plain-text password per academic mini-project specification
    user_type NVARCHAR(20) NOT NULL CHECK (user_type IN ('Generator', 'Recycler')),
    eco_points INT NOT NULL DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- 2.2 WasteCategories Table
-- Lookup table specifying category name and carbon emissions reduction factor (kg CO2 saved per kg of waste recycled).
CREATE TABLE WasteCategories (
    category_id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE,
    co2_saved_per_kg DECIMAL(6, 2) NOT NULL CHECK (co2_saved_per_kg >= 0)
);
GO

-- 2.3 WasteListings Table
-- Listings published by Generators detailing waste type, weight, and status.
CREATE TABLE WasteListings (
    listing_id INT IDENTITY(1,1) PRIMARY KEY,
    generator_id INT NOT NULL,
    category_id INT NOT NULL,
    title NVARCHAR(200) NOT NULL,
    weight_kg DECIMAL(10, 2) NOT NULL CHECK (weight_kg > 0),
    status NVARCHAR(20) NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Accepted', 'Completed', 'Cancelled')),
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_WasteListings_Generator FOREIGN KEY (generator_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_WasteListings_Category FOREIGN KEY (category_id) REFERENCES WasteCategories(category_id)
);
GO

-- 2.4 ExchangeRequests Table
-- Exchange offers submitted by Recyclers to claim listings posted by Generators.
CREATE TABLE ExchangeRequests (
    request_id INT IDENTITY(1,1) PRIMARY KEY,
    listing_id INT NOT NULL,
    recycler_id INT NOT NULL,
    request_status NVARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (request_status IN ('Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled')),
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_ExchangeRequests_Listing FOREIGN KEY (listing_id) REFERENCES WasteListings(listing_id) ON DELETE CASCADE,
    CONSTRAINT FK_ExchangeRequests_Recycler FOREIGN KEY (recycler_id) REFERENCES Users(user_id)
);
GO

-- 3. TRIGGER IMPLEMENTATION
-- ==============================================================================
-- Requirement: An AFTER UPDATE trigger on ExchangeRequests.
-- When a request becomes 'Completed', automatically change the WasteListings status
-- to 'Completed' and add 10 eco_points to the Generator's Users record.
-- Supports multi-row updates in set-based T-SQL logic.
CREATE TRIGGER trg_ExchangeRequests_Completed
ON ExchangeRequests
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Verify if any row transitioned from a non-Completed state to 'Completed'
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        INNER JOIN deleted d ON i.request_id = d.request_id
        WHERE i.request_status = 'Completed' AND d.request_status <> 'Completed'
    )
    BEGIN
        -- 1. Automatically update corresponding WasteListings status to 'Completed'
        UPDATE wl
        SET wl.status = 'Completed'
        FROM WasteListings wl
        INNER JOIN inserted i ON wl.listing_id = i.listing_id
        INNER JOIN deleted d ON i.request_id = d.request_id
        WHERE i.request_status = 'Completed' AND d.request_status <> 'Completed';

        -- 2. Award 10 eco_points to the Generator who posted the waste listing
        UPDATE u
        SET u.eco_points = u.eco_points + 10
        FROM Users u
        INNER JOIN WasteListings wl ON u.user_id = wl.generator_id
        INNER JOIN inserted i ON wl.listing_id = i.listing_id
        INNER JOIN deleted d ON i.request_id = d.request_id
        WHERE i.request_status = 'Completed' AND d.request_status <> 'Completed';
    END
END;
GO

-- 4. VIEW IMPLEMENTATION
-- ==============================================================================
-- Requirement: UserImpactDashboard view that joins tables to calculate
-- total weight diverted and total CO2 saved per user.
CREATE VIEW UserImpactDashboard AS
WITH UserCompletedActivity AS (
    -- Completed activity for Generators
    SELECT 
        wl.generator_id AS user_id,
        wl.weight_kg,
        (wl.weight_kg * wc.co2_saved_per_kg) AS co2_saved,
        1 AS is_exchange
    FROM WasteListings wl
    INNER JOIN WasteCategories wc ON wl.category_id = wc.category_id
    WHERE wl.status = 'Completed'

    UNION ALL

    -- Completed activity for Recyclers
    SELECT 
        er.recycler_id AS user_id,
        wl.weight_kg,
        (wl.weight_kg * wc.co2_saved_per_kg) AS co2_saved,
        1 AS is_exchange
    FROM ExchangeRequests er
    INNER JOIN WasteListings wl ON er.listing_id = wl.listing_id
    INNER JOIN WasteCategories wc ON wl.category_id = wc.category_id
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
    ISNULL(ls.total_listings_posted, 0) AS total_listings_posted,
    ISNULL(ai.completed_exchanges, 0) AS completed_exchanges,
    CAST(ISNULL(ai.total_weight_diverted, 0) AS DECIMAL(10, 2)) AS total_weight_diverted,
    CAST(ISNULL(ai.total_co2_saved, 0) AS DECIMAL(10, 2)) AS total_co2_saved
FROM Users u
LEFT JOIN AggregatedImpact ai ON u.user_id = ai.user_id
LEFT JOIN ListingsSummary ls ON u.user_id = ls.user_id;
GO

-- 5. ACID TRANSACTION STORED PROCEDURE (ROW LOCKING)
-- ==============================================================================
-- Requirement: Transaction with row locking when a request is accepted to prevent double-booking.
-- Prevents race conditions where two recyclers' requests are accepted concurrently.
CREATE PROCEDURE sp_AcceptExchangeRequest
    @RequestId INT,
    @GeneratorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON; -- Ensures automatic rollback upon unhandled runtime errors

    BEGIN TRANSACTION;

    BEGIN TRY
        DECLARE @ListingId INT;
        DECLARE @ListingStatus NVARCHAR(20);
        DECLARE @RequestStatus NVARCHAR(20);

        -- Fetch Request info
        SELECT 
            @ListingId = er.listing_id,
            @RequestStatus = er.request_status
        FROM ExchangeRequests er
        WHERE er.request_id = @RequestId;

        IF @ListingId IS NULL
        BEGIN
            RAISERROR('Exchange request does not exist.', 16, 1);
        END

        IF @RequestStatus <> 'Pending'
        BEGIN
            RAISERROR('This request is not in Pending status.', 16, 1);
        END

        -- CRITICAL ACID ROW LOCK:
        -- Lock the WasteListings row using UPDLOCK and ROWLOCK hints to prevent concurrent modifications
        SELECT 
            @ListingStatus = status
        FROM WasteListings WITH (UPDLOCK, ROWLOCK)
        WHERE listing_id = @ListingId AND generator_id = @GeneratorId;

        IF @ListingStatus IS NULL
        BEGIN
            RAISERROR('Listing not found or user is not authorized to accept requests for this listing.', 16, 1);
        END

        IF @ListingStatus <> 'Available'
        BEGIN
            RAISERROR('Listing is already booked or no longer available.', 16, 1);
        END

        -- Step A: Accept the target request
        UPDATE ExchangeRequests
        SET request_status = 'Accepted'
        WHERE request_id = @RequestId;

        -- Step B: Update the listing status to 'Accepted'
        UPDATE WasteListings
        SET status = 'Accepted'
        WHERE listing_id = @ListingId;

        -- Step C: Automatically reject all other pending requests for this listing
        UPDATE ExchangeRequests
        SET request_status = 'Rejected'
        WHERE listing_id = @ListingId 
          AND request_id <> @RequestId 
          AND request_status = 'Pending';

        -- COMMIT TRANSACTION: Atomicity, Consistency, Isolation, and Durability preserved
        COMMIT TRANSACTION;

        SELECT 
            'SUCCESS' AS result,
            'Request accepted successfully. Listing status updated and competing requests rejected.' AS message,
            @ListingId AS listing_id;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Propagate error details to caller
        THROW;
    END CATCH
END;
GO

-- 6. SEED DATA FOR DEMO & TESTING
-- ==============================================================================

-- 6.1 Waste Categories with EPA/Carbon Trust CO2 savings factors (kg CO2 saved per kg recycled)
INSERT INTO WasteCategories (name, co2_saved_per_kg) VALUES
('Plastic (PET / HDPE)', 1.50),
('Paper & Cardboard', 1.10),
('Metals (Aluminum & Steel)', 4.00),
('Glass', 0.30),
('E-Waste (Electronics)', 3.20),
('Organic Waste', 0.50);
GO

-- 6.2 Sample Users (Password is plain-text as requested)
INSERT INTO Users (name, email, password, user_type, eco_points) VALUES
('Alice Green (Cafe Owner)', 'alice@generator.com', 'password123', 'Generator', 20),
('Bob Clean (Urban Recycler)', 'bob@recycler.com', 'password123', 'Recycler', 0),
('Metro Supermarket', 'metro@generator.com', 'password123', 'Generator', 10),
('EcoPlast Recycling Ltd', 'ecoplast@recycler.com', 'password123', 'Recycler', 0);
GO

-- 6.3 Sample Listings
INSERT INTO WasteListings (generator_id, category_id, title, weight_kg, status) VALUES
(1, 2, 'Bundled Cardboard Boxes (Flat Pack)', 45.00, 'Available'),
(1, 1, 'Clean HDPE Milk Jugs and PET Bottles', 20.00, 'Available'),
(3, 3, 'Scrap Aluminum Beverage Cans & Food Tins', 35.50, 'Available'),
(3, 6, 'Kitchen Vegetable & Fruit Scraps (Compost Grade)', 80.00, 'Completed');
GO

-- 6.4 Sample Requests & Trigger Demonstration Verification
-- Insert a completed request to populate initial view statistics
INSERT INTO ExchangeRequests (listing_id, recycler_id, request_status) VALUES
(4, 2, 'Completed');
GO

-- Verify View Works
SELECT * FROM UserImpactDashboard;
GO
