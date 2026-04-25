# InvenIQ — AI-Powered Inventory & Warehouse Management System

InvenIQ is a comprehensive, production-ready full-stack software platform that modernizes B2B inventory management. It combines a robust relational backend with a highly dynamic React frontend, augmented by advanced Artificial Intelligence features to predict restocking needs, detect stock anomalies, and give managers a Natural Language SQL analytics dashboard.

## 🌟 Key Features

### 1. Multi-Warehouse Management
Track stock across multiple warehouses simultaneously. Perform seamless inter-warehouse transfers and maintain distinct reorder levels and stock values per location.

### 2. Deep Operational Workflows
A real-world implementation of complex inventory workflows, supporting atomic transactions across SQL.
- **Transactions Lifecycle:** Stock-ins from suppliers, stock-outs to clients, system adjustments, and full historical auditing.
- **Order Pipeline:** Moving from `Draft` -> `Confirmed` -> `Dispatched` -> `Completed` with automated inventory deductions.
- **Returns System:** Unified customer returns and supplier returns with defect tracking.

### 3. State-of-the-art AI Operations (Google Gemini 2.0 Integration)
- **Natural Language "Ask AI" Dashboard:** Ask questions like *"Which product had the most returns this month?"* and watch the system securely generate PostgreSQL queries and format the result tables.
- **AI Alert Summaries:** Automatic one-click plain-English summaries for technical discrepancy alerts, designed for non-technical warehouse managers.

### 4. Machine Learning Scripts
Independent scheduled Python modules driving supply chain intelligence:
- **Restock Predictor:** Uses historical rolling 30-day consumption velocity to predict future stockouts, suggesting restock quantities.
- **Anomaly Detector:** Implements a Z-score statistical threshold (flagging >2σ deviations) to catch unusual spikes in stock movements, helping prevent theft or data-entry errors.

### 5. Role-Based Security (RBAC)
Configurable and deeply integrated authorization (`Admin`, `Manager`, `Staff`, `Viewer`), limiting sensitive analytics, transaction creation, and settings modification exclusively to upper management.

---

## 🛠️ Technology Stack

1. **Frontend**: React 18, Vite, Tailwind CSS (Custom Color System & UI Library), Recharts, React Router v6, Axios.
2. **Backend Engine**: Node.js, Express.js.
3. **Database Layer**: PostgreSQL (Fully normalized 3NF Schema with 12 Tables, Triggers, and Foreign Keys).
4. **Machine Learning / Cron**: Python 3, `psycopg2`.
5. **AI API**: Google Generative AI (`gemini-2.0-flash`).

---

## 🚀 Setup & Installation (Local Development)

An automated Windows setup script is provided.

### Easy Setup
1. Ensure you have **Node.js**, **PostgreSQL**, and **Python 3** installed locally.
2. Ensure your Postgres installation uses the default `postgres` username and the password is set in the `setup.bat` (Default: `Chint@n1`).
3. Double-click the `setup.bat` file in the root directory. This will automatically:
   - Create the `inveniq` database.
   - Run the complex schema migrations.
   - `npm install` both the frontend and backend.
   - Populate over 500+ records of highly realistic mock data (Warehouses, Products, Transactions spanning 30 days, Spikes for ML, anomalies, orders).
   - Install the Python ML dependencies.

### Running the Application

**Terminal 1 (Backend API)**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend App)**
```bash
cd frontend
npm run dev
```

Visit the application at: `http://localhost:5173`

#### Demo Credentials:
- **Admin**: `admin@inveniq.com`
- **Manager**: `manager@inveniq.com`
- **Staff**: `staff@inveniq.com`
- **Viewer**: `viewer@inveniq.com`
*(Password for all accounts is: `Admin@123`)*

---

## 🧠 Triggering ML Scripts

To test the Machine Learning capabilities and see them populate the frontend alerts dashboard, you can run the Python scripts manually (or configure them as a CRON job / Windows Task Scheduler):

```bash
# Run Restock Predictor
cd ml
python restock_predictor.py

# Run Anomaly Detector
python anomaly_detector.py
```

*Alternatively, Admins can trigger these scripts directly from the Frontend UI within the **"Alerts"** page.*
