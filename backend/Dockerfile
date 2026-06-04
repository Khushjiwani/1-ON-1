FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY package*.json ./

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "src/index.js"]
