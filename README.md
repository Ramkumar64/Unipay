# Unipay
CrossBorderX – Multi-Currency Payment System

Overview
Unipay is a backend system designed to handle secure and reliable multi-currency transactions. The system focuses on concurrency control, transaction safety, and data consistency, simulating real-world payment processing systems.

It is built to demonstrate how modern payment platforms ensure reliability under concurrent requests and prevent issues such as double spending.

Key Features

Multi-currency transaction support (USD, INR, EUR, GBP)
Concurrency-safe transaction processing
Idempotent API design to prevent duplicate operations
Append-only ledger for transaction traceability
Transaction validation and failure handling mechanisms
Modular backend architecture

System Architecture

The system follows a modular backend design:

Client → API Layer → Transaction Service → Database

Core components:

Transaction Service – Handles transfers and validations
Ledger System – Maintains transaction history
Database Layer – Ensures consistency and atomicity

How It Works

User initiates a transaction request
Input validation is performed
Row-level locking ensures safe concurrent execution
Transaction is processed atomically
Ledger entry is recorded for auditability
Response is returned to the client

Tech Stack

Backend: Node.js / Express
Database: PostgreSQL
APIs: RESTful APIs

Concepts Used:

ACID Transactions
Concurrency Control
Idempotency
Fault Tolerance

API Endpoints (Example)

Create Transaction
POST /api/transactions

Request:
{
"fromAccount": "A",
"toAccount": "B",
"amount": 100,
"currency": "INR"
}

Get Transaction History
GET /api/transactions/:id

Key Concepts Implemented

Concurrency Control
Ensures that multiple transactions do not corrupt data using row-level locking.

Idempotency
Prevents duplicate transactions by handling repeated requests safely.

Ledger System
Maintains an append-only record of all transactions for audit and consistency.

Installation and Setup

Clone the repository:
git clone https://github.com/Ramkumar64/Unipay.git

Install dependencies:
npm install

Run the application:
npm start

Future Improvements

Integration with real payment gateways (Stripe, Razorpay)
Microservices-based architecture
Message queues for event-driven processing
Distributed transaction handling

Author

Ramkumar R
Backend-focused Software Engineer
Email: ramaravind21135@gmail.com

GitHub: https://github.com/Ramkumar64
