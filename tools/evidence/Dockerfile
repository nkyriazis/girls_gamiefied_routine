# Plays a scenario in Chromium and mixes what it played into the video (record.sh)
FROM mcr.microsoft.com/playwright:v1.55.0-noble
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 && rm -rf /var/lib/apt/lists/*
# Linked at the root, so a scenario anywhere under the repo (mounted at /repo) finds it (npm won't install in /)
WORKDIR /opt/kit
RUN echo '{"private":true}' > package.json && npm install --no-audit --no-fund playwright@1.55.0 && ln -s /opt/kit/node_modules /node_modules
