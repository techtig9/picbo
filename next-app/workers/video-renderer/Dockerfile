FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
CMD ["npm","run","worker"]
