HomeKeep

Property & Home Maintenance Tracker

HomeKeep is a full-stack web application designed to help homeowners track property details, maintenance history, and ongoing home expenses in one centralized place. The project was inspired by my experience as a new homeowner needing a better way to organize maintenance records, receipts, and costs over time.

This application is being developed as a capstone project and focuses on real-world functionality, clean architecture, and secure data handling.


Features Implemented So Far
Authentication & Security

User registration and login

JWT-based authentication

Protected API routes and frontend pages

User-scoped data access (users can only see their own data)

Properties

Create and view property profiles

Store address details, purchase date, and notes

Each property is securely linked to its owner

Maintenance Tracking

Add maintenance records per property

Track service date, category, cost, vendor, and notes

View maintenance history by property

Dashboard

Monthly and yearly maintenance spending totals

Recent maintenance activity across all properties

Custom sparkline chart showing daily spending trends over the last 30 days (implemented with SVG, no charting libraries)


Tech Stack
Frontend

React (Vite)

React Router

Context API for authentication state

Plain CSS / inline styles for UI

Backend

Node.js

Express

MongoDB (Atlas)

Mongoose

JWT authentication


Architecture Overview

RESTful API design

Clear separation of concerns:

Routes

Controllers

Models

Middleware

Client and server communicate via JSON APIs

Aggregation logic handled on the backend for dashboard summaries


Getting Started (Local Development)
Prerequisites

Node.js (v18+ recommended)

MongoDB Atlas account (or local MongoDB)

Backend Setup
cd homekeep-api
npm install
npm run dev


Create a .env file:

PORT=5050
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

Frontend Setup
cd homekeep-client
npm install
npm run dev


Frontend runs on:

http://localhost:5173 (or next available port)


Backend runs on:

http://localhost:5050


API Health Check
GET /api/v1/health



Returns a success response when the API is running correctly.

📓 Development Log

Weekly devlogs are maintained to document:

Progress made

Challenges encountered

Technical decisions and reasoning

Key learnings throughout the project


Planned Enhancements

Document uploads (receipts, invoices, warranties)

Scanning documents for key data (amounts, dates, vendors)

User-editable overrides for scanned data

Maintenance reminders and notifications

Improved dashboard insights


Author

Tamara Reid
Capstone Project – Software Development Bootcamp
