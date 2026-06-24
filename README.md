# CalorieBank

CalorieBank is a full-stack calorie tracking app built around a simple idea: calories can be treated like a daily and weekly balance. Instead of only showing what a user has eaten, the app calculates what they have available based on their profile, food entries, and extra calories burned.

The project is built as a MERN-style application with a Vite React frontend, an Express API, MongoDB persistence, JWT authentication, and optional S3 food photo uploads.

## Why I Built It

Most food trackers focus on restriction. I wanted to build a more practical experience that helps users plan around real life: track meals, bank unused calories, log workouts, and see how today affects the week.

This project gave me a chance to practice full-stack product thinking, not just isolated CRUD. The app includes authenticated user data, profile-based calorie calculations, date-aware logs, file uploads, protected routes, and deployment-ready environment configuration.

## Features

- User registration and login with JWT authentication
- TDEE calculation from height, weight, age, sex, and activity level
- Daily food logging with calories, protein, carbs, and fats
- Date-based log viewing for past or current entries
- Extra burned-calorie logging by activity
- Daily calorie bank calculation: `TDEE + extra burn - intake`
- Weekly banking history with consumed, burned, and banked totals
- Joy Banking Center for planning treats against saved calories
- Optional food photo uploads backed by AWS S3
- Light and dark theme support
- Deployment-ready API URL and CORS configuration

## Tech Stack

**Frontend**

- React
- Vite
- React Router
- Tailwind CSS
- Lucide React
- Recharts

**Backend**

- Node.js
- Express
- MongoDB
- Mongoose
- JWT
- bcrypt
- Multer
- AWS SDK for S3

## Architecture

```text
CalorieBank/
├── backend/
│   ├── controllers/       # API request logic
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
| Uploads | `POST` | `/api/upload/food-photo/:entryId` | Upload a food photo |

## What I Focused On

- Keeping user data protected with token-based API routes
- Modeling daily logs so each user has one log per date
- Normalizing dates to avoid off-by-one issues in daily and weekly views
- Making the frontend API base URL configurable for deployment
- Separating route, controller, model, and UI concerns
- Building a product concept that shows both technical implementation and user empathy

## Validation

Current checks:

```sh
cd frontend && npm run build
cd backend && node --check server.js
```

The production frontend build passes, and the backend entry file passes Node syntax validation.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting setup, environment variables, and deployment order.

## Future Improvements

- Add automated backend route tests
- Add frontend component tests for logged-in workflows
- Add image validation and cleanup for replaced S3 uploads
- Add password reset and profile editing
- Add charts for longer-term calorie trends
