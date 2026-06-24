# CalorieBank Deployment

This app has two deployable services:

- `backend`: Node/Express API
- `frontend`: Vite React static site

## Backend

Deploy `backend` as a Node web service.

- Root directory: `backend`
- Node version: `>=20.19.0`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/`

Set these environment variables in the host:

- `MONGO_URI`
- `JWT_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_BUCKET_NAME`
- `FRONTEND_URL`
- `NODE_ENV=production`

`FRONTEND_URL` should be the deployed frontend origin, for example `https://your-app.vercel.app`. For multiple origins, use a comma-separated list.

## Frontend

Deploy `frontend` as a Vite static site.

- Root directory: `frontend`
- Node version: `>=20.19.0`
- Build command: `npm install && npm run build`
- Publish/output directory: `dist`

Set this environment variable before building:

- `VITE_API_BASE_URL=https://your-backend-host`

## Suggested Order

1. Deploy the backend first.
2. Copy the backend URL into the frontend's `VITE_API_BASE_URL`.
3. Deploy the frontend.
4. Copy the frontend URL into the backend's `FRONTEND_URL`.
5. Redeploy or restart the backend so the CORS setting is active.

## Local Check

From each service directory:

```sh
npm install
npm run build
```

The backend has no build step; use `npm start` to verify it can connect to MongoDB with the configured environment.
