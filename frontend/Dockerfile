FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL
ARG APP_ENV=production
ENV VITE_API_URL=${VITE_API_URL}
ENV APP_ENV=${APP_ENV}
RUN test -n "$VITE_API_URL" && \
    if [ "$APP_ENV" = "production" ]; then \
      case "$VITE_API_URL" in https://*) ;; *) echo "Production VITE_API_URL must use HTTPS" >&2; exit 1 ;; esac; \
    fi && npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
