FROM node:24.20.0-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY shared shared
COPY server server
COPY web web
RUN pnpm -r build

FROM node:24.20.0-bookworm-slim AS runtime
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN pnpm install --prod --frozen-lockfile --filter "@hiroba/server..."
COPY --from=build /src/shared/dist shared/dist
COPY --from=build /src/server/dist server/dist
COPY --from=build /src/server/drizzle server/drizzle
COPY --from=build /src/web/dist server/public
ENV NODE_ENV=production
ENV TZ=Asia/Taipei
ENV SCHEDULE_TIME_ZONE=Asia/Taipei
ENV PORT=3000
ENV DB_PATH=/data/hiroba.sqlite
ENV WEB_DIST=/app/server/public
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server/dist/adapters/node/main.js"]
