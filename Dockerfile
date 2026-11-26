# DMTabata web (PWA): build do Expo para web servido por nginx.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: dispensa compilar módulos nativos de teste (better-sqlite3), que o build web não usa.
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY . .
RUN npm run web:build

FROM nginx:alpine
RUN apk add --no-cache curl
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/headers.conf /etc/nginx/snippets/dmtabata-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
