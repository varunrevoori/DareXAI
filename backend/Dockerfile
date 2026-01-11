# Multi-stage build for Node.js backend
FROM node:20 AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production --legacy-peer-deps

# Copy source code
COPY . .

# Build TypeScript
RUN npm install -D typescript ts-node @types/node
RUN npm run build || npx tsc

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production --legacy-peer-deps

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]
