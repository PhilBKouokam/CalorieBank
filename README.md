# CalorieBank

A full-stack calorie tracking application that treats calories like a bank account, helping users log meals, track activity, and plan treats around a weekly calorie bank.

## 🎥 2-Minute Walkthrough

https://www.loom.com/share/3a0f06928e004bad80cd4ae181f65d1c

## 🌐 Live Demo

https://caloriebank-pi.vercel.app

## 💻 Source Code

https://github.com/PhilBKouokam/caloriebank

## 📸 Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Dashboard</strong><br />
      <img src="screenshots/dashboard.png" alt="CalorieBank dashboard with calorie bank, macros, and activity tracking" width="420">
    </td>
    <td align="center" width="50%">
      <strong>Add Food Entry</strong><br />
      <img src="screenshots/add-entry.png" alt="CalorieBank add food entry form" width="420">
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>Food Entries and Photo Uploads</strong><br />
      <img src="screenshots/food-entries-list.png" alt="CalorieBank food entries list with logged meals" width="420">
    </td>
    <td align="center" width="50%">
      <strong>Joy Bank and Treat Planner</strong><br />
      <img src="screenshots/joybank.png" alt="CalorieBank Joy Bank weekly planner" width="420">
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <strong>Dark Mode</strong><br />
      <img src="screenshots/dark-mode.png" alt="CalorieBank dark mode dashboard" width="420">
    </td>
  </tr>
</table>

## Why I Built This

Most calorie tracking apps focus on restriction and daily calorie limits. I wanted to explore a different mental model: treating calories like a bank account.

Instead of feeling like one higher-calorie meal ruins your progress, CalorieBank helps users budget calories across the week, making nutrition more flexible and sustainable while still supporting long-term fitness goals.

From an engineering perspective, the project focuses on account-based authentication, user-owned data, backend calorie banking logic, image uploads, date normalization, and production deployment across separate frontend and backend services.

## Features

- Register and log in with JWT-based authentication.
- Receive a personalized TDEE estimate during registration.
- Log meals with calories, protein, carbs, fats, and optional food photos.
- Upload food images to AWS S3 and save photo URLs with meal entries.
- Record extra burned activity and update daily calorie calculations.
- View a dashboard with consumed calories, macros, TDEE, extra burn, and weekly bank.
- Use the Joy Bank to review weekly banking history and plan treat meals.
- Toggle between light and dark mode.
- Use the app across desktop and mobile screen sizes.

## Engineering Highlights

- JWT authentication for stateless user sessions.
- bcrypt password hashing before user records are stored.
- Protected React Router routes for authenticated pages.
- React Context state management for authentication, daily logs, and weekly bank data.
- REST API architecture with separate route and controller layers.
- MongoDB and Mongoose schemas for users, daily food logs, meal entries, and burned activities.
- User-scoped database queries to protect private nutrition records.
- Backend-owned TDEE and calorie banking calculations so the server remains the source of truth.
- Date normalization to keep one daily log per user per calendar date.
- AWS S3 food photo uploads using the AWS SDK.
- Multer multipart uploads with in-memory file handling.
- Client-server architecture with separate frontend and backend deployments.
- Responsive Tailwind CSS interface with dark mode support.

## 🏗 Architecture

CalorieBank follows a client-server architecture where the React frontend owns the user experience and the backend owns authentication, authorization, persistence, calorie banking calculations, and food image storage.

`React UI` → `React Context` → `REST API` → `Express Controllers` → `MongoDB with Mongoose` → `API Response` → `React UI Update`

For food photo uploads:

`React FormData Upload` → `Multer Middleware` → `AWS S3` → `Photo URL Saved in MongoDB` → `React UI Update`

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

## Key User Flows

`Register` → `Login` → `Dashboard` → `Log Food` → `Upload Food Photo` → `Record Extra Burn` → `Joy Bank` → `Plan Treat Meal`

## Tech Stack

**Frontend:** React, React Router, React Context, JavaScript, Tailwind CSS, Lucide React, Recharts, Vite

**Backend:** Node.js, Express, JavaScript

**Database:** MongoDB, Mongoose

**Authentication:** JWT, bcrypt

**Cloud:** AWS S3, Multer

**Deployment:** Vercel frontend, Render backend, MongoDB Atlas

**Developer Tools:** npm, ESLint, Git, GitHub

## API Overview

Deployed API: https://caloriebank-backend.onrender.com

| Method | Route | Description | JWT Required |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Create a user, calculate TDEE, hash the password, and return a JWT. | No |
| POST | `/api/auth/login` | Validate credentials and return a JWT. | No |
| GET | `/api/foodlog?date=YYYY-MM-DD` | Get or create a daily food log for the authenticated user. | Yes |
| GET | `/api/foodlog/weekly-bank?date=YYYY-MM-DD` | Fetch weekly banking history for the authenticated user. | Yes |
| POST | `/api/foodlog/entry` | Add a meal entry to the authenticated user's daily log. | Yes |
| PATCH | `/api/foodlog/entry/:entryId` | Update a meal entry owned by the authenticated user. | Yes |
| DELETE | `/api/foodlog/entry/:entryId` | Delete a meal entry owned by the authenticated user. | Yes |
| POST | `/api/foodlog/burned` | Log extra burned calories for a daily log. | Yes |
| PATCH | `/api/foodlog/burned/:activityId` | Update a burned activity entry. | Yes |
| DELETE | `/api/foodlog/burned/:activityId` | Delete a burned activity entry. | Yes |
| POST | `/api/upload/food-photo/:entryId` | Upload a food photo to S3 and save the photo URL on the meal entry. | Yes |

## Local Development

### Prerequisites

- Node.js `>=20.19.0`
- npm
- MongoDB connection string
- AWS S3 bucket and credentials for food photo uploads

### Backend

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` using `backend/.env.example`:

```bash
PORT=4700
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>
JWT_SECRET=<jwt-secret>
AWS_ACCESS_KEY_ID=replace-with-your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=replace-with-your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=replace-with-your-s3-bucket-name
NODE_ENV=development
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env` using `frontend/.env.example`:

```bash
VITE_API_BASE_URL=http://localhost:4700
```

Open the frontend development server in your browser, register an account, and start tracking meals and activity.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting setup, environment variables, and deployment order.

## 🚀 Future Improvements

- Food database with auto calorie lookup.
- Password reset flow.
- Weekly and monthly trend charts.
- Automated frontend and backend tests.
- Progressive Web App (PWA) support.
- Stronger request validation with a schema validation library.
- Move authentication to HTTP-only cookies for stronger token storage.
