# BankAssist AI - Quick Start Guide

## 1. Prerequisites
- **Python 3.10+** (if running locally)
- **Node.js 18+** (if running locally)
- **Gemini API Key** (Required for the LLM)
- **Docker** (Recommended for full stack orchestration)

## 2. Setting up the Environment
1. Open the `.env` file in the root directory.
2. Replace `your_gemini_api_key_here` with your actual Google Gemini API Key.
3. If running via Docker, leave `QDRANT_HOST=qdrant`. If running locally, change it to `QDRANT_HOST=localhost`.

## 3. Running with Docker (Highly Recommended)
```bash
docker-compose up --build
```
This will start:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Qdrant DB**: http://localhost:6333

## 4. Testing the System (Step-by-Step)

### Step A: Load Knowledge Base
1. Open the frontend (http://localhost:5173).
2. Click on the **"Knowledge Base"** tab in the sidebar.
3. Upload the test files located in `backend/data/test_samples/`:
   - `public_faq.txt` -> Set Access: **Public**
   - `kyc_policy_internal.txt` -> Set Access: **Internal**
   - `risk_framework_restricted.txt` -> Set Access: **Restricted**

### Step B: Test Question & RBAC
Go to the **"BankAssist AI"** (Chat) tab and try these cases:

| Role | Question | Expected Result | Reason |
| :--- | :--- | :--- | :--- |
| **External Customer** | "What are the bank hours?" | "Our branches are open..." | Information is Public. |
| **External Customer** | "What is the KYC policy?" | "Insufficient information available." | Policy is Internal. Filtered out. |
| **Internal Employee** | "What is the KYC policy?" | "Standard Operating Procedure for KYC..." | Employee has Internal access. |
| **Internal Employee** | "What is the Tier-1 capital ratio?" | "Insufficient information available." | Information is Restricted. Filtered out. |
| **Compliance Officer**| "What is the Tier-1 capital ratio?" | "The Tier-1 capital ratio must be..." | Admin/Compliance has Restricted access. |

## 5. Troubleshooting
- **No answer from AI?** Check if your `GEMINI_API_KEY` is valid in the `.env` file.
- **Qdrant Error?** Ensure Docker is running or Qdrant is installed locally.
- **Frontend not loading?** Run `npm install` inside the `frontend` directory first if running locally.
