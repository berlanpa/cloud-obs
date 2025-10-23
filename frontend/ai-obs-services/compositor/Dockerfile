# ===== STAGE 1: Dependencies =====
FROM node:20-alpine AS deps

# Install FFmpeg
RUN apk add --no-cache ffmpeg

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
FROM node:20-alpine AS builder

WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace root
COPY package.json package-lock.json ./

# Copy service files
COPY services/compositor ./services/compositor

# Build the service
WORKDIR /app/services/compositor
RUN npm run build

# ===== STAGE 3: Runner =====
FROM node:20-alpine AS runner

# Install FFmpeg in runtime
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy built service
COPY --from=builder /app/services/compositor/dist ./dist
COPY --from=builder /app/services/compositor/package.json ./package.json

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3004

CMD ["npm", "start"]
