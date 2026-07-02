FROM node:22-alpine AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder

WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DB_FILE_NAME=file:/app/runtime/local.db
ENV APP_DB_PATH=/app/runtime/local.db
ENV SEED_DB_PATH=/app/data/seed/isw-quiz.seed.db
ENV PDF_PYTHON_BIN=/usr/bin/python3

# Python + reportlab/pillow servono alla generazione PDF (/api/pdf).
RUN apk add --no-cache python3 py3-pip py3-pillow \
  && pip3 install --no-cache-dir --break-system-packages reportlab

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/scripts ./scripts
COPY data/seed ./data/seed
COPY docker ./docker

RUN chmod +x /app/docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["npm", "run", "start"]
