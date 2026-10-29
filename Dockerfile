# syntax-marker:deploy-f-generated-dockerfile-v1
FROM node:lts
ENV NG_CLI_ANALYTICS=false
ENV NODE_ENV=production
ENV CI=true
ADD https://my.deploy-f.com/f/entrypoint.sh?2 /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN curl -s https://my.deploy-f.com/f/prepare-nodejs.sh?2 | bash -s false
WORKDIR /app
COPY [".", "/app"]
RUN curl -s https://my.deploy-f.com/f/install-nodejs.sh?2 | bash -s
WORKDIR "/app"
RUN if [ ! -f package.json ]; then \
      echo '[Deploy-f] package.json not found in /app, auto-detecting...' && \
      PKG=$(find /app -name package.json -not -path '*/node_modules/*' -maxdepth 5 -type f | head -1) && \
      if [ -n "$PKG" ]; then \
        DIR=$(dirname "$PKG") && \
        echo "[Deploy-f] Found package.json in: $DIR - copying to working directory" && \
        cp -a "$DIR"/. .; \
      else \
        echo '[Deploy-f] ERROR: package.json not found in archive. Make sure your archive contains package.json.' && exit 1; \
      fi; \
    fi
RUN find . -type d -name '__MACOSX' -exec rm -rf {} + 2>/dev/null || true && \
    find . -type f -name '._*' -delete 2>/dev/null || true
RUN export NODE_ENV=development && npm install --no-audit --no-fund --prefer-offline --fetch-retries=3 --fetch-retry-mintimeout=5000 --fetch-retry-maxtimeout=60000 </dev/null
RUN curl -s https://my.deploy-f.com/f/install-nodejs.sh?2 | bash -s snapshot
CMD /entrypoint.sh node /app/server.js