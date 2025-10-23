# ===== STAGE 1: Dependencies =====
FROM node:18-alpine AS deps

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy ALL package.json files for workspace structure (BEFORE npm ci)
COPY shared/types/package.json ./shared/types/
COPY services/decision-service/package.json ./services/decision-service/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/tts-orchestrator/package.json ./services/tts-orchestrator/
COPY services/program-producer/package.json ./services/program-producer/
COPY services/compositor/package.json ./services/compositor/
COPY web-obs/package.json ./web-obs/

# Now npm ci will create proper workspace links
RUN npm ci

# Copy and build shared types
COPY shared/types ./shared/types
WORKDIR /app/shared/types
RUN npm run build

# ===== STAGE 2: Builder =====
FROM node:18-alpine AS builder

WORKDIR /app

# Copy node_modules and shared types from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared ./shared

# Copy workspace root
COPY package.json package-lock.json ./

# Copy service files
COPY services/program-producer ./services/program-producer

# Build the service
WORKDIR /app/services/program-producer
RUN npm run build

# ===== STAGE 3: Runner =====
FROM node:18-alpine AS runner

WORKDIR /app

# Copy built service
COPY --from=builder /app/services/program-producer/dist ./dist
COPY --from=builder /app/services/program-producer/package.json ./package.json

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

CMD ["node", "dist/services/program-producer/src/index.js"]
