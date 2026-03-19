# Sejuk Sejuk Ops System (Programmer Assessment)

Sejuk Sejuk Ops System is a simplified internal operations tool for a fictional air-conditioning service company.
It allows Admins to create orders, Technicians to complete jobs, and Managers to track KPIs and query operations via a mock AI assistant.

Live Demo: [https://sejuk-sejuk-ops-system.vercel.app](https://sejuk-sejuk-ops-system.vercel.app)

A simplified internal operations system for Sejuk Sejuk Service Sdn Bhd (fictional), covering:

Order Submission -> Assignment -> Service Completion -> WhatsApp Trigger -> Manager KPI + AI Query

## What I Built

### 1) Mock Login + Role Routing

Implemented role-based navigation (mock, no real auth):

- Admin -> `/admin`
- Technician -> `/technician`
- Manager -> `/manager`

Files:
- `src/pages/Login.tsx`
- `src/App.tsx`
- `src/main.tsx`

### 2) Module 1 - Admin Portal (Order Submission)

Implemented in `src/pages/AdminDashboard.tsx`.

Features:
- Auto-generated order number (`ORDER${Date.now()}`)
- Form fields:
  - Customer Name
  - Phone
  - Address
  - Problem Description
  - Service Type (dropdown)
  - Quoted Price
  - Assigned Technician (Ali, John, Bala, Yusoff)
  - Admin Notes
- Supabase insert into `orders`
- Explicit status on creation: `Assigned`
- Success behavior:
  - Form reset
  - Submitted order summary panel
- Bonus:
  - WhatsApp deep-link to assigned technician after submission

### 3) Module 2 - Technician Portal (Service Job)

Implemented in `src/pages/TechnicianDashboard.tsx`.

Features:
- Fetch and list assigned jobs by technician name:
  - `assigned_technician = <technician>`
- Mobile-first card UI for field usage
- Supabase Storage upload to bucket: `technician-uploads`
- Save completion data into `orders`:
  - `status = Job Done`
  - `completed_at`
  - `work_done`
  - `extra_charges`
  - `final_amount`
  - `remarks`
  - `completion_file_urls` (jsonb)
  - optional payment fields:
    - `payment_amount`
    - `payment_method`
    - `payment_receipt_url`
- Bonus:
  - WhatsApp deep-link notification to customer when job is marked done
  - manager notification timestamp attempt (`manager_notified_at`)

<details>
<summary>Completion Form Fields (Technician)</summary>

- Order ID (read-only)
- Work Done
- Extra Charges
- Upload up to 6 files
- Final Amount (auto-calc)
- Remarks
- Technician Name
- Timestamp preview
- Optional payment fields:
  - Payment Amount
  - Payment Method
  - Receipt Photo

</details>

### 4) Module 3 - WhatsApp Notification Trigger

Implemented via deep-link helper in:
- `src/utils/helpers.ts`

Triggered on:
- Admin assigning a job (to technician)
- Technician marking a job as `Job Done` (to customer)

### 5) Bonus Module - KPI Dashboard

Implemented in `src/pages/ManagerDashboard.tsx`.

Features:
- Fetches completed jobs (`status = Job Done`)
- Aggregates by `assigned_technician`:
  - Jobs completed per technician
  - Total earnings per technician (sum of `final_amount`)
- Displays KPI cards and sorted technician performance cards

### 6) AI Module - Operations Query Window (Fake AI, data-driven)

Implemented in `src/pages/ManagerDashboard.tsx`.

Flow:
1. User inputs a question
2. Question interpreter detects intent
3. Supabase queries fetch scoped data
4. Formatter returns human-like response
5. UI displays response

Supported intents:
- `today` -> TODAY_JOBS
- `week` -> WEEK_JOBS
- `most` -> TOP_TECHNICIAN
- technician name token -> TECHNICIAN_JOBS

Supported question examples:
- How many jobs were completed today?
- Who completed the most jobs this week?
- What jobs did Ali complete?

Fallback behavior:
- Unknown intent returns guided response with supported question examples.

Architecture note:
- Current AI module is frontend-only (no live OpenAI dependency required).
- Backend `/ask-ai` exists as optional mock/demo endpoint but is not required by current UI flow.

## Tech Stack

### Frontend
- React + TypeScript + Vite
- Tailwind CSS
- HeadlessUI
- React Router

### Backend / Data
- Supabase (Postgres + Storage)

### Optional Backend (mock)
- Node.js + Express + CORS + dotenv (`../backend/index.js`)

## Supabase Setup

### 1) Environment Variables

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Restart dev server after setting env vars.

### 2) `orders` Table Schema

Current table columns used by the app:

- `id` (uuid)
- `order_no` (text)
- `customer_name` (text)
- `phone` (text)
- `address` (text)
- `problem_description` (text)
- `service_type` (text)
- `quoted_price` (numeric)
- `assigned_technician` (text)
- `admin_notes` (text)
- `status` (text default `New`)
- `created_at` (timestamp default `now()`)
- `completed_at` (timestamp)
- `work_done` (text)
- `extra_charges` (numeric)
- `final_amount` (numeric)
- `remarks` (text)
- `completion_file_urls` (jsonb)
- `payment_amount` (numeric)
- `payment_method` (text)
- `payment_receipt_url` (text)
- `manager_notified_at` (timestamp)

### 3) Storage

Bucket:
- `technician-uploads` (Public)

Used for:
- completion files
- optional payment receipt images

RLS:
- Storage upload policies are configured in Supabase.

## Local Setup

### Frontend

```bash
npm install
npm run dev
```

### Backend (optional)

```bash
cd ../backend
npm install
npm start
```

Backend routes:
- `GET /` -> Backend is working
- `POST /ask-ai` -> mock AI response

## How to Test Main Workflow

1. Open `/` and choose a role from login page.
2. Admin:
   - Create an order and assign technician.
3. Technician:
   - Enter technician name.
   - Open assigned job.
   - Fill completion form and submit.
   - Verify status becomes `Job Done`.
   - Verify files upload and URLs save.
4. Manager:
   - Check KPI cards and technician performance.
   - Ask AI-style operational questions.

## Architecture Decisions

- Chose mock login + role routing to satisfy assessment scope quickly.
- Kept AI module data-driven and controlled, querying only relevant subsets from Supabase.
- Used status transitions (`Assigned`, `Job Done`) to model core workflow.
- Used WhatsApp deep-link for lightweight notification integration without third-party API dependency.

## Limitations / Assumptions

- Real authentication/authorization is not implemented (mock role switch only).
- Full workflow statuses (`In Progress`, `Reviewed`, `Closed`) are not fully enforced via dedicated UI/actions.
- Business rules are primarily UI-driven; production setup should enforce rules in RLS/backend.
- AI module is a fake AI formatter over real operational data (no LLM required in current flow).

## What I Would Improve (Production)

- Add real auth with role-based access control.
- Enforce workflow transitions with stricter database policies.
- Add manager review actions for `Reviewed` / `Closed`.
- Add audit logs for key actions.
- Upgrade AI module to backend LLM integration with structured prompt contracts and guardrails.
