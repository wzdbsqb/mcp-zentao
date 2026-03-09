FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev

ENV NODE_ENV=production \
    MCP_TRANSPORT=sse \
    MCP_SERVER_PORT=3000 \
    ZENTAO_URL="" \
    ZENTAO_USERNAME="" \
    ZENTAO_PASSWORD="" \
    ZENTAO_API_VERSION="v1"

EXPOSE 3000

CMD ["node", "dist/index.js"]
