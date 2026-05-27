# ─── Stage 1: Compile uhubctl (isolated build stage) ─────────────────────────
FROM alpine:3.21 AS uhubctl-builder
RUN sed -i 's/http:/https:/g' /etc/apk/repositories \
 && apk add --no-cache git make gcc musl-dev libusb-dev linux-headers
RUN git clone --depth=1 --branch v2.6.0 https://github.com/mvp/uhubctl.git /tmp/uhubctl \
    && cd /tmp/uhubctl && make

# ─── Stage 2: Lean Bun runner ─────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app

RUN sed -i 's/http:/https:/g' /etc/apk/repositories \
 && (for i in 1 2 3; do \
      apk add --no-cache \
        cups-client \
        sane-utils \
        libusb \
        ca-certificates \
        util-linux \
        poppler-utils \
        ghostscript \
        imagemagick \
      && exit_code=0 && break || exit_code=$? && echo "Retrying main apk add..." && sleep 3; \
    done; exit $exit_code) \
 && (for i in 1 2 3; do \
      apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/testing ipp-usb \
      && exit_code=0 && break || exit_code=$? && echo "Retrying edge ipp-usb apk add..." && sleep 3; \
    done; exit $exit_code)

COPY --from=uhubctl-builder /tmp/uhubctl/uhubctl /usr/local/sbin/uhubctl

# Copy locally built standalone files, static assets, and public directory
COPY .next/standalone ./
COPY .next/static     ./.next/static
COPY public           ./public

# Copy environment variables for runtime configuration
COPY .env.local* ./


ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV CUPS_SERVER=/var/run/cups/cups.sock

EXPOSE 8080
CMD ["bun", "server.js"]