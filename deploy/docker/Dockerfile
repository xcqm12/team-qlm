# 七零喵团队站点 · 后端镜像（多阶段构建，产物镜像极小）
# 说明：后端使用 Node.js 内置的 node:sqlite，因此不需要编译任何原生模块。

FROM node:22-alpine AS backend-deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev --omit=optional --no-audit --no-fund

FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build:only

FROM node:22-alpine AS runtime
LABEL org.opencontainers.image.title="team-site-backend" \
      org.opencontainers.image.description="七零喵团队站点后端（Express + SQLite + 文件上传）"

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    DB_FILE=/data/team-site.db \
    UPLOAD_DIR=/data/uploads

RUN apk add --no-cache tini tzdata python3 \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app
COPY --from=backend-deps /app/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY tools/ ./tools/
COPY deploy/nginx/team-site.conf ./deploy/nginx/team-site.conf
COPY --from=frontend-build /app/dist ./frontend/dist

RUN mkdir -p /data/uploads/thumbnails /app/logs \
    && node backend/scripts/init-db.js \
    && node backend/scripts/seed.js \
    && chown -R node:node /data /app/logs

VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/src/server.js"]
