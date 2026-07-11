# CalorieBank

CalorieBank is a full-stack calorie tracking application built with React, Node.js, Express, and MongoDB that treats calories like a bank account, helping users save calories throughout the week for planned treats while staying on track with their nutrition goals.

## 🚀 Quick Links

🎥 **2-Minute Project Walkthrough**  
https://www.loom.com/share/3a0f06928e004bad80cd4ae181f65d1c

🌐 **Live Application**  
https://caloriebank-pi.vercel.app/

💻 **Source Code**  
This repository

![CalorieBank Dashboard](screenshots/dashboard.png)

## ⚡ Built With

React • Node.js • Express • MongoDB • AWS S3 • JWT Authentication • Tailwind CSS

## 👀 What You'll See

✔ Secure user registration and JWT authentication

✔ Personalized TDEE calculation

✔ Food logging with image uploads

✔ Activity tracking

✔ Automatic calorie banking

✔ Joy Bank weekly planner

## 💡 Why I Built This

Most calorie tracking apps focus on restriction and daily calorie limits. I wanted to explore a different mental model: treating calories like a bank account.

Instead of feeling like one higher-calorie meal ruins your progress, CalorieBank helps users budget calories across the week, making nutrition more flexible and sustainable while still supporting long-term fitness goals.

---

## 🛠️ Tech Stack

**Frontend**
- React + Vite
- React Router
- Tailwind CSS
- Lucide React (icons)
- Context API for state management

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- AWS SDK (S3 photo uploads)
- bcrypt for password hashing

---

## ✨ Features

- User authentication with JWT
- Personalized TDEE calculation (height, weight, age, sex, activity level)
- Daily food logging with macros (calories, protein, carbs, fats)
- Food photo uploads stored in AWS S3
- Automatic daily calorie bank calculation (`TDEE + extra burn - intake`)
- Weekly banking history and progress tracking
- Dark/Light mode support
- Responsive, modern UI with Tailwind CSS

---

## 🏗️ Engineering Highlights

- Built a RESTful Express API with JWT-protected routes.
- Designed MongoDB schemas for users, daily food logs, meal entries, and burned activities.
- Implemented automatic TDEE-based calorie banking logic on the backend.
- Added date normalization to ensure each user has exactly one daily log per day.
- Integrated AWS S3 using Multer for secure food image uploads.
- Deployed a split frontend/backend architecture using Vercel, Render, MongoDB Atlas, and AWS S3.

---

## 🎯 Project Goals

This project was built to demonstrate:

- Full-stack application architecture
- Secure JWT authentication
- REST API design
- MongoDB data modeling
- AWS S3 integration
- React Context state management
- Responsive UI development
- Production deployment

---

## 🔄 Key User Flows

1. A new user registers and receives a personalized TDEE estimate.
2. The dashboard initializes with today's food log and weekly calorie bank.
3. The user logs meals, uploads food photos, and records extra burned activity.
4. The backend recalculates the calorie bank after every update.
5. The Joy Bank visualizes weekly progress and helps users plan treat meals using their accumulated calorie bank.

---

## Screenshots

![Dashboard](screenshots/dashboard.png)
![Add Entry](screenshots/add-entry.png)
![Dark Mode](screenshots/dark-mode.png)
![Food Entries List](screenshots/food-entries-list.png)
![Joy Bank](screenshots/joybank.png)

---

## Architecture

CalorieBank follows a clean client-server architecture. The React frontend communicates with a RESTful Express API, controllers contain the business logic, MongoDB stores application data, and AWS S3 stores uploaded food images.

```text
CalorieBank/
├── backend/               # Express API
│   ├── controllers/       # Business logic
│   ├── middleware/        # JWT protection
│   ├── models/            # Mongoose schemas
│   ├── routes/            # Express route definitions
│   ├── utils/             # Shared date normalization
│   └── server.js          # Express app and MongoDB connection
├── frontend/
│   ├── src/components/    # Reusable UI sections
│   ├── src/context/       # Auth and food log state
│   ├── src/pages/         # Route-level screens
│   └── src/utils/api.js   # API client helper
└── DEPLOYMENT.md
```

## Getting Started

### Prerequisites

- Node.js `>=20.19.0`
- MongoDB Atlas or a local MongoDB connection string
- AWS S3 bucket and credentials if using food photo uploads

### Backend Setup

```sh
cd backend
npm install
cp .env.example .env
npm run dev
```

Required backend environment variables:

```env
MONGO_URI=
JWT_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET_NAME=
FRONTEND_URL=http://localhost:5173
PORT=4700
NODE_ENV=development
```

### Frontend Setup

```sh
cd frontend
npm install
cp .env.example .env
npm run dev
```

Required frontend environment variable:

```env
VITE_API_BASE_URL=http://localhost:4700
```

## API Overview

> **Authentication:** All Food Log, Banking, and Upload endpoints require a valid JWT Bearer Token after login.

| Area | Method | Route | Purpose |
| --- | --- | --- | --- |
| Auth | `POST` | `/api/auth/register` | Create a user and return a JWT |
| Auth | `POST` | `/api/auth/login` | Authenticate a user |
| Food Logs | `GET` | `/api/foodlog?date=YYYY-MM-DD` | Get or create a daily log |
| Food Logs | `POST` | `/api/foodlog/entry` | Add a food entry |
| Food Logs | `PATCH` | `/api/foodlog/entry/:entryId` | Update an entry |
| Food Logs | `DELETE` | `/api/foodlog/entry/:entryId` | Delete an entry |
| Food Logs | `POST` | `/api/foodlog/burned` | Log extra burned calories |
| Bank | `GET` | `/api/foodlog/weekly-bank` | Get weekly banking history |
| Uploads | `POST` | `/api/upload/food-photo/:entryId` | Upload a food photo to S3 |

## What I Focused On

- Building a practical and positive calorie tracking experience
- Clean separation of concerns (controllers, routes, models, context)
- Proper date normalization for daily logs
- Secure file uploads with AWS S3
- Responsive design with dark mode support
- Production-ready deployment configuration

## Validation

Current validation includes:

```sh
cd frontend && npm run build
cd backend && node --check server.js
```

The frontend production build passes successfully, and the backend entry point passes Node.js syntax validation.

Comprehensive unit and integration testing is planned for future iterations as the project continues to evolve.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting setup, environment variables, and deployment order.

## ⚖️ Design Decisions

**State Management**

React Context was chosen because the application's shared state is relatively small and predictable. As the project grows, React Query or Redux Toolkit could provide improved server-state management and caching.

**Backend Business Logic**

Business logic intentionally lives on the backend so the frontend remains focused on rendering state while the server remains the source of truth for calorie banking calculations.

## Future Improvements

- Food database with auto calorie lookup
- Password reset flow
- Weekly/monthly trend charts
- Unit tests
- Progressive Web App (PWA) support
