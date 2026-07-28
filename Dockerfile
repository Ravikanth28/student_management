# ── Stage 1: Build Frontend ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy and install dependencies first (layer cache)
COPY frontend/package*.json ./
RUN npm install --include=dev

# Copy source and build
COPY frontend/ ./
# VITE_API_BASE_URL is intentionally empty: the backend serves the frontend
# on the same origin, so /api/* calls work without a base URL.
RUN npm run build

# ── Stage 2: Build Backend ────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --include=dev

COPY backend/ ./
RUN npm run build

# ── Stage 3: Production image ─────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy backend production deps only
COPY backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled backend
COPY --from=backend-builder /app/backend/dist ./dist

# Copy built frontend into dist/public (where the Express server looks)
COPY --from=frontend-builder /app/frontend/dist ./dist/public

USER appuser

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "dist/server.js"]
