# Lightweight Node.js 22 runtime with native node:sqlite
FROM node:22-alpine

WORKDIR /app

# Copy application files
COPY package.json ./
COPY server.js ./
COPY public ./public
# Ensure uploads directory exists
RUN mkdir -p uploads

# Configuration defaults
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV DEMO_MODE=true

EXPOSE 3000

CMD ["node", "server.js"]

