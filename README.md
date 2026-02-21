HomeKeep

Property & Home Maintenance Tracker

HomeKeep is a full-stack web application designed to help homeowners organize property information, track maintenance history, and monitor long-term home expenses in one centralized platform.

The project was inspired by my experience as a new homeowner needing a reliable system to manage receipts, service records, and maintenance costs over time.

Developed as a capstone project, HomeKeep emphasizes:

Clean architecture

Secure authentication & data isolation

Modular backend design

Integration testing

Real-world problem solving

🌐 Live Application

Frontend: (Insert deployed frontend URL here)
API: (Insert deployed API URL here)

📌 Project Overview

HomeKeep allows authenticated users to:

Create and manage multiple properties

Track maintenance activities per property

View historical spending trends

Monitor monthly and yearly maintenance totals

Access their data securely through JWT authentication

Each user’s data is fully isolated and securely scoped to their account.

✨ Core Features
🔐 Authentication & Security

User registration and login

JWT-based authentication

Protected API routes

Protected frontend routes

User-scoped data access (multi-tenant safe design)

Environment variable configuration for secrets

🏡 Property Management

Create property profiles

Store:

Address

Purchase date

Notes

Each property is securely linked to its owner

🛠 Maintenance Tracking

Add maintenance records per property

Track:

Service date

Category

Cost

Vendor

Notes

View maintenance history per property

Auth-protected CRUD endpoints

📊 Dashboard & Analytics

Monthly maintenance spending total

Yearly maintenance spending total

Recent maintenance activity list

Custom sparkline visualization (built using SVG — no external charting libraries)

Backend aggregation logic using MongoDB

🧠 Architecture Overview

HomeKeep follows industry-standard full-stack architecture principles.

Backend Architecture (Node + Express + MongoDB)
src/
 ├── routes/
 ├── controllers/
 ├── models/
 ├── middleware/
 ├── config/
 ├── utils/
Design Principles Applied

Separation of concerns

Modular route/controller structure

RESTful API design

Middleware-driven authentication

Centralized error handling

Stateless JWT authentication

Data aggregation handled server-side

Frontend Architecture (React + Vite)

React Router for client-side routing

Context API for authentication state

Protected route components

API abstraction layer

Component-based UI structure

State-driven rendering

Data Flow

Frontend → API Service Layer → Express Routes → Controllers → Mongoose Models → MongoDB
Response returned as structured JSON.

🧪 Testing & Debugging

HomeKeep includes automated integration tests for the backend API.

Testing Frameworks Used

Jest

Supertest

mongodb-memory-server (in-memory MongoDB instance)

This approach ensures:

Tests run independently of production databases

Authentication and middleware are fully exercised

Core data flows are validated end-to-end

What Is Covered

User registration

User login

Protected route access (/api/v1/me)

Property creation (auth required)

Property listing (auth required)

Running API Tests
cd homekeep-api
npm install
npm test

Tests validate:

Authentication logic

JWT middleware enforcement

CRUD functionality

Response structure

Data isolation

🚀 Deployment

HomeKeep is deployed using a modern cloud-based architecture:

Frontend:

Deployed via Vercel / Netlify (CDN optimized)

Backend:

Deployed via Render / Railway

Database:

MongoDB Atlas (managed cloud database)

Deployment Considerations

Environment variables securely configured

MongoDB Atlas connection string secured

JWT secrets not committed to source control

CORS configured appropriately

Stateless API design for scalability

Production build optimization (Vite)

🔧 Getting Started (Local Development)
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

Backend runs at:

http://localhost:5050
Frontend Setup
cd homekeep-client
npm install
npm run dev

Frontend runs at:

http://localhost:5173
📓 Development Log

Weekly devlogs document:

Progress milestones

Architectural decisions

Debugging process

Challenges and solutions

Key learnings from real-world implementation

Notable debugging milestones include:

Resolving Jest test discovery issues

Ensuring JWT middleware correctly blocks unauthorized access

Structuring integration tests with in-memory MongoDB

Verifying protected CRUD endpoints through automated tests

📈 Planned Enhancements

Document upload support (receipts, warranties)

OCR-based receipt scanning

Editable parsed data overrides

Maintenance reminders & notifications

Role-based access

CI pipeline for automated testing

Cloud file storage integration

Error monitoring integration

🛡 Security Considerations

JWT-based authentication

Protected routes (frontend + backend)

User-scoped MongoDB queries

Environment variable usage

No secrets committed to repository

Stateless session design

🏗 Future Scalability

Stateless API supports horizontal scaling

MongoDB Atlas supports auto-scaling

Aggregation logic centralized for performance

Client-side caching improvements planned

👩‍💻 Author

Tamara Reid
Capstone Project – Software Development Bootcamp

📜 License

This project is developed for educational purposes as part of a software development bootcamp capstone.
