# ===== STAGE 1: Dependencies =====
FROM node:18-alpine AS deps

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy ALL package.json files for workspace structure (BEFORE npm ci)
COPY services/decision-service/package.json ./services/decision-service/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/tts-orchestrator/package.json ./services/tts-orchestrator/
COPY services/program-producer/package.json ./services/program-producer/
COPY services/compositor/package.json ./services/compositor/
COPY web-obs/package.json ./web-obs/

# Now npm ci will create proper workspace links
RUN npm ci

# ===== STAGE 2: Builder =====
FROM node:18-alpine AS builder

WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace root
COPY package.json package-lock.json ./

# Copy shared types (required dependency)
COPY shared ./shared

# Copy web-obs files
COPY web-obs ./web-obs

# Build Next.js app
WORKDIR /app/web-obs
RUN npm run build

# ===== STAGE 3: Runner =====
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built Next.js artifacts
COPY --from=builder /app/web-obs/.next ./.next
COPY --from=builder /app/web-obs/public ./public
COPY --from=builder /app/web-obs/package.json ./
COPY --from=builder /app/web-obs/next.config.js ./

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
