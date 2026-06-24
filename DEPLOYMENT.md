# CalorieBank - Deployment Guide

This document explains how to deploy **CalorieBank V0.1** (Backend + Frontend).

## Overview

- **Backend**: Node.js + Express API (deployed on Render)
- **Frontend**: React + Vite (deployed on Vercel)

---

## Backend Deployment (Render)

### Settings
- **Service Type**: Web Service
- **Root Directory**: `backend`
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

### Environment Variables (Required)

| Variable                | Description                          | Example |
|-------------------------|--------------------------------------|--------|
| `MONGO_URI`             | MongoDB Atlas connection string      | `mongodb+srv://...` |
| `JWT_SECRET`            | Secret key for JWT tokens            | Long random string |
| `AWS_ACCESS_KEY_ID`     | AWS IAM Access Key                   | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Key                   | `...` |
| `AWS_REGION`            | AWS Region                           | `us-east-1` |
| `AWS_BUCKET_NAME`       | S3 Bucket name                       | `caloriebank-food-photos-2026-phil` |
| `NODE_ENV`              | Environment                          | `production` |

> **Important**: Add `0.0.0.0/0` to your MongoDB Atlas **Network Access** (for development).

---

## Frontend Deployment (Vercel)

### Settings
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Environment Variable

| Variable             | Value |
|----------------------|-------|
| `VITE_API_BASE_URL`  | Your Render backend URL (e.g. `https://caloriebank-backend.onrender.com`) |

---

## Post-Deployment Steps

1. Deploy the **backend** first.
2. Copy the backend URL and set it as `VITE_API_BASE_URL` in the frontend.
3. Deploy the **frontend**.
4. Copy the frontend URL and add it to the backend's CORS settings (`origin` array in `server.js`).
5. Redeploy the backend.

---

## Local Development

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev

Troubleshooting

CORS Error: Make sure the frontend URL is added in backend CORS configuration.
MongoDB Connection: Verify IP whitelist includes 0.0.0.0/0.
Photo Upload Fails: Check AWS credentials and bucket permissions.


Live Links

Frontend: https://caloriebank-pi.vercel.app/
Backend: https://your-backend.onrender.com