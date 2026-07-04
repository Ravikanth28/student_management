# Student Management Portal

Monorepo scaffold for a production-oriented student management portal with separate frontend and backend projects.

## Structure

- `frontend`: React + Vite admin portal
- `backend`: Express + JWT + TiDB API

## Phone App Path

The frontend is built mobile-first and is now scaffolded for Capacitor Android wrapping. That keeps the API and UI reusable instead of rebuilding the app twice.

See [docs/android-apk-setup.md](docs/android-apk-setup.md) for the APK path.

## Next steps

1. Install dependencies inside `frontend` and `backend`.
2. Create the `.env` values from the examples.
3. Run the backend and frontend independently.
4. Add Capacitor when you want an installable Android package.

## Run Commands

Backend:

```powershell
Set-Location 'd:\student management\backend'
npm install
npm run dev
```

Frontend:

```powershell
Set-Location 'd:\student management\frontend'
npm install
npm run dev
```

Admin login is configured via environment variables in `backend/.env`
(`ADMIN_USERNAME` and `ADMIN_PASSWORD` for local dev, or `ADMIN_PASSWORD_HASH`
in production). See `backend/.env.example`.
