# ♻️ ReLoop: Waste Exchange & Recycling Marketplace

**ReLoop** is a full-stack waste exchange marketplace application designed to demonstrate enterprise database management systems (DBMS) concepts using **Azure SQL Database (T-SQL)**, a **Node.js/Express** backend, and a clean **Vanilla JavaScript/HTML/CSS** frontend.

The project connects **Waste Generators** (e.g., cafes, packaging businesses, households) with **Recyclers** to divert waste from landfills and track environmental impact (CO₂ emission reductions and Eco Points).

---

## 🏛️ Core DBMS Concepts Demonstrated

| DBMS Concept | Implementation Object | Real-World Application & Mechanism |
| :--- | :--- | :--- |
| **ACID Transaction with Row Locking** | `sp_AcceptExchangeRequest` / `PUT /api/requests/accept` | **Concurrency Control:** When a Generator accepts an exchange request, the listing row is locked using `UPDLOCK, ROWLOCK`. Competing pending requests are automatically rejected in the same atomic transaction, preventing double-booking and race conditions. |
| **Database Trigger** | `trg_ExchangeRequests_Completed` | **Event-Driven Automation:** An `AFTER UPDATE` trigger on `ExchangeRequests`. When an exchange transitions to `'Completed'`, the trigger automatically marks the corresponding `WasteListings` record as `'Completed'` and awards **10 Eco Points** to the Generator. |
| **Database View** | `UserImpactDashboard` | **Data Abstraction & Aggregation:** Joins `Users`, `WasteListings`, `WasteCategories`, and `ExchangeRequests` to compute total weight diverted (kg), completed exchanges, and carbon emission reductions (kg CO₂ saved). |

---

## 📁 Project Folder Structure

```text
d:\waste proeject\
├── .env                          # Local Azure SQL credentials (git-ignored)
├── .env.example                  # Environment configuration template
├── package.json                  # Node.js dependencies and run scripts
├── db.js                         # Azure SQL connection pool configuration
├── server.js                     # Express REST API backend
├── database.sql                  # Complete T-SQL DDL script (Tables, Trigger, View, Proc, Seed Data)
├── README.md                     # Documentation and presentation guide
└── public/                       # Frontend web client (Vanilla HTML, CSS, JS)
    ├── index.html                # Login & Registration page (Plain-text authentication)
    ├── marketplace.html          # Waste marketplace grid & listing creation modal
    ├── dashboard.html            # User Impact metrics view, ACID actions & trigger verification
    ├── css/
    │   └── style.css             # Responsive, eco-themed UI stylesheet
    └── js/
        └── app.js                # Fetch API client, localStorage state, interactive handlers
```

---

## 🗄️ Database Architecture (`database.sql`)

### 1. Relational Schema
- **`Users`**: `user_id` (PK, INT IDENTITY), `name`, `email` (UNIQUE), `password` (Plain-text), `user_type` ('Generator' | 'Recycler'), `eco_points` (DEFAULT 0), `created_at`.
- **`WasteCategories`**: `category_id` (PK), `name` (UNIQUE), `co2_saved_per_kg` (DECIMAL).
- **`WasteListings`**: `listing_id` (PK), `generator_id` (FK to Users), `category_id` (FK to WasteCategories), `title`, `weight_kg`, `status` ('Available' | 'Accepted' | 'Completed' | 'Cancelled').
- **`ExchangeRequests`**: `request_id` (PK), `listing_id` (FK to WasteListings), `recycler_id` (FK to Users), `request_status` ('Pending' | 'Accepted' | 'Rejected' | 'Completed' | 'Cancelled').

---

### 2. ACID Transaction & Row Locking Deep Dive

When multiple recyclers compete for the same listing, simultaneous requests could cause a **double-booking anomaly**. 

In ReLoop, the acceptance process uses row-level locking:
```sql
-- Lock the WasteListings row exclusively for update
SELECT @CurrentListingStatus = status
FROM WasteListings WITH (UPDLOCK, ROWLOCK)
WHERE listing_id = @ListingId AND generator_id = @GeneratorId;
```
- **Atomicity:** All three actions (Accept request, mark listing accepted, reject competing requests) commit together or all roll back.
- **Consistency:** Enforces integrity checks and prevents invalid status transitions.
- **Isolation:** `UPDLOCK` prevents another transaction from acquiring an update lock on the same listing until completion.
- **Durability:** Committed data is safely written to Azure SQL transaction logs.

---

### 3. T-SQL AFTER UPDATE Trigger Deep Dive

The trigger guarantees data consistency without depending solely on application-tier logic:

```sql
CREATE TRIGGER trg_ExchangeRequests_Completed
ON ExchangeRequests
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 FROM inserted i
        INNER JOIN deleted d ON i.request_id = d.request_id
        WHERE i.request_status = 'Completed' AND d.request_status <> 'Completed'
    )
    BEGIN
        -- 1. Automatically update corresponding WasteListings to Completed
        UPDATE wl
        SET wl.status = 'Completed'
        FROM WasteListings wl
        INNER JOIN inserted i ON wl.listing_id = i.listing_id
        INNER JOIN deleted d ON i.request_id = d.request_id
        WHERE i.request_status = 'Completed' AND d.request_status <> 'Completed';

        -- 2. Award 10 Eco Points to the Generator
        UPDATE u
        SET u.eco_points = u.eco_points + 10
        FROM Users u
        INNER JOIN WasteListings wl ON u.user_id = wl.generator_id
        INNER JOIN inserted i ON wl.listing_id = i.listing_id
        INNER JOIN deleted d ON i.request_id = d.request_id
        WHERE i.request_status = 'Completed' AND d.request_status <> 'Completed';
    END
END;
```

---

### 4. Database View (`UserImpactDashboard`)

Provides a consolidated real-time calculation of environmental savings by joining multiple tables:
- **`total_weight_diverted`**: Sum of kilograms diverted from completed listings.
- **`total_co2_saved`**: Computed dynamically via $\sum (\text{weight\_kg} \times \text{co2\_saved\_per\_kg})$.
- **`completed_exchanges`**: Number of successfully fulfilled recycling cycles.

---

## 🚀 Setup & Execution Guide

### Step 1: Execute SQL Script in Azure SQL Database
1. Open the [Azure Portal](https://portal.azure.com) or **SQL Server Management Studio (SSMS)** / **Azure Data Studio**.
2. Connect to your Azure SQL Database.
3. Open `database.sql` and execute the entire script.
4. Verify that tables, trigger, view, stored procedure, and seed data are populated.

### Step 2: Configure Environment Variables
Open `.env` in the project root and fill in your Azure SQL credentials:
```env
DB_SERVER=your-azure-sql-server.database.windows.net
DB_DATABASE=reloop_db
DB_USER=your_azure_username
DB_PASSWORD=YourPassword123!
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false
PORT=3000
```

### Step 3: Install Dependencies & Start Server
```powershell
# In the project directory:
npm install
npm start
```
The server will start at: **`http://localhost:3000`**

---

## 🧪 Pre-Seeded Accounts for Demo & Viva

| Role | Name | Email | Password | Pre-loaded Data |
| :--- | :--- | :--- | :--- | :--- |
| **Generator** | Alice Green | `alice@generator.com` | `password123` | Has 2 Available listings (Cardboard, Plastics) |
| **Recycler** | Bob Clean | `bob@recycler.com` | `password123` | Can claim listings and mark pickups |
| **Generator** | Metro Supermarket | `metro@generator.com` | `password123` | Has 1 Available (Scrap Aluminum) & 1 Completed |

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/register` | Register new user (Generator / Recycler) |
| `POST` | `/api/login` | Simple plain-text authentication |
| `GET` | `/api/categories` | Retrieve waste categories and CO₂ multipliers |
| `GET` | `/api/listings` | Fetch all Available waste listings |
| `POST` | `/api/listings` | Create a new waste listing (Generator only) |
| `POST` | `/api/requests` | Submit an exchange request (Recycler only) |
| `PUT` | `/api/requests/accept` | **ACID Transaction:** Row-locks listing, accepts request, rejects competing offers |
| `PUT` | `/api/requests/complete` | **SQL Trigger:** Marks request completed, fires trigger to update listing and award +10 pts |
| `GET` | `/api/dashboard/:userId` | **SQL View:** Queries `UserImpactDashboard` view + active user records |

---

## 🎓 Academic Viva Questions & Answers

**Q1: How does ReLoop ensure ACID Isolation when accepting requests?**  
> We use the T-SQL row locking hint `WITH (UPDLOCK, ROWLOCK)` within a `BEGIN TRANSACTION ... COMMIT` block. This ensures that while one request is being accepted, no other user or concurrent thread can acquire an update lock on the same listing row.

**Q2: Why use a Database Trigger instead of Node.js backend logic for points and status updates?**  
> Enforcing this logic inside an `AFTER UPDATE` trigger in the DBMS guarantees **data integrity at the database level**. Regardless of whether updates are made via the Web UI, an API, or directly via SQL scripts/SSMS, the business rule (updating listing status and granting points) will always be enforced.

**Q3: What are the benefits of the `UserImpactDashboard` View?**  
> The View encapsulates complex multi-table joins and aggregation logic. The client application executes a simple `SELECT * FROM UserImpactDashboard WHERE user_id = @userId`, keeping backend queries clean and centralizing calculations in the database engine.
