# BankAssist AI - Enterprise Operations System

Welcome to the **BankAssist AI** repository. This project is a production-ready, highly secure Enterprise AI Knowledge Chatbot designed specifically for strict banking operations and regulatory compliance.

It allows bank employees to chat with an AI that instantly retrieves information from thousands of pages of deeply complex Bank Standard Operating Procedures (SOPs), while enforcing absolute cryptographic access control based on the employee's rank.

---

## 🏗️ 1. Core Architecture
This project uses a modern, high-performance stack configured for the strict requirements of financial technology (FinTech):

*   **Brain (LLM):** Google Gemini 2.0 Flash - Analyzes massive banking texts in milliseconds with zero delay.
*   **Memory (Vector DB):** Qdrant - Handles complex embedding models to map relationships in financial logic.
*   **Backend engine:** FastAPI (Python 3) - Handles rapid parallel requests necessary during peak branch hours.
*   **Frontend UI:** React (+ Vite) with modern glassmorphism - A highly responsive, dynamic premium banking interface explicitly styled for professionals.

---

## 🚀 2. Enterprise Banking Features
1.  **Strict Source Verification (RAG):** The AI scans actual uploaded bank manuals before answering. It provides exact references (`REF: your_file.pdf`) for every claim, absolutely preventing AI hallucination.
2.  **Role-Based Access Control (RBAC):** Documents are tagged with clearance levels (`Public`, `Internal`, `Restricted`, `Compliance`). An `Internal_Employee` account physically cannot retrieve AI answers meant for a `Compliance_Officer`.
3.  **Real-Time Regulatory Audit Ledger:** The system secretly logs *every single query* made by branch staff to ensure absolute compliance and provide the security team with a full audit trail.
4.  **Branch SOP Vault:** A specialized library where staff can manually browse authorized procedures and securely download them.
5.  **Dynamic Markdown AI Feedback:** The AI mathematically formats all answers with enterprise-grade tables, bolded warnings, and clear operational lists.

---

## 💻 3. Getting Started - Local Development

Follow these steps to boot the entire banking engine on your local machine if you are collaborating on this project.

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- A **Gemini API Key** from Google AI Studio.

### Step 1: Environment Setup
1. Clone this repository via Git.
2. Navigate to `backend/.env` (Create the file if it doesn't exist).
3. Insert your API Key: `GEMINI_API_KEY="your_api_key_here"`

### Step 2: Start the Backend (Vector DB + FastAPI)
Open a new terminal window:
```bash
cd backend
pip install -r requirements.txt
python run_backend.py
```
*Note: Make sure to ONLY run one instance of `python run_backend.py` at a time. The Qdrant Neural Database strictly locks its memory file to prevent corruption!*

### Step 3: Start the Frontend UI (React + Vite)
Open a second terminal window:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## 🧪 4. How to Test the Access Controls

When presenting or demoing the system, use these steps to prove the strict banking security:

### Part A: Upload Knowledge
1. Log in.
2. Go to the **Knowledge Archival** tab.
3. Upload three different dummy files and assign them three different statuses:
   - `branch_hours.txt` -> Clearance: **Public**
   - `teller_guidelines.txt` -> Clearance: **Internal**
   - `anti_money_laundering.txt` -> Clearance: **Restricted**

### Part B: Interrogate the AI
Go to the **Enterprise Assistant** (Chat) tab to prove the strict firewall works:

| Logged-In Role | Chat Query | AI Response | Security Validation |
| :--- | :--- | :--- | :--- |
| **External Customer** | *"What are the bank hours?"* | "Our branch is open 9-5..." | Returns successfully (Information is Public). |
| **External Customer** | *"What is the teller guideline?"* | "I cannot answer this." | Correctly Blocked (Information is Internal). |
| **Internal Employee** | *"What is the teller guideline?"* | "As a teller, you must..." | Returns successfully (Employee has Clearance). |
| **Internal Employee** | *"Show me AML protocols."* | "I cannot answer this." | Correctly Blocked (Information is Restricted). |
| **Compliance Officer**| *"Show me AML protocols."* | "The AML protocols dictate..." | Returns successfully (Officer has Admin Clearance). |

---

## 🤝 5. Contributing
If you are pushing code to this project, ensure you review the `PROJECT_DOSSIER.md` to understand the overarching architectural philosophy. Never bypass the SQLAlchemy User Role restrictions when developing new dashboard modules.
