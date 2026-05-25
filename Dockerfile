# ─── Stage 1: Build Next.js with Bun ─────────────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --verbose
COPY . .
RUN bun run build

# ─── Stage 2: Compile uhubctl (isolated build stage) ─────────────────────────
FROM alpine:3.21 AS uhubctl-builder
RUN apk add --no-cache git make gcc musl-dev libusb-dev linux-headers
RUN git clone --depth=1 https://github.com/mvp/uhubctl.git /tmp/uhubctl \
    && cd /tmp/uhubctl && make

# ─── Stage 3: Lean Bun runner ────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app

RUN apk add --no-cache \
    cups-client \
    sane-utils \
    libusb \
    ca-certificates \
    sudo \
    poppler-utils \
    ghostscript \
    imagemagick \
    ipp-usb

COPY --from=uhubctl-builder /tmp/uhubctl/uhubctl /usr/local/sbin/uhubctl
RUN mkdir -p /home/pi/uhubctl && ln -s /usr/local/sbin/uhubctl /home/pi/uhubctl/uhubctl

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV CUPS_SERVER=/var/run/cups/cups.sock

EXPOSE 8080
CMD ["bun", "server.js"]