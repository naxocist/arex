FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM deps AS build
WORKDIR /app
COPY . .
# NEXT_PUBLIC_* vars are baked at build time — pass via --build-arg
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run sets PORT at runtime; HOSTNAME must be 0.0.0.0 for container binding
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
