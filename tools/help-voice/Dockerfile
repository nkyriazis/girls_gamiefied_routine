# The owl's voice, made at development time: VoxCPM2 speaks, faster-whisper listens back.
# Needs an NVIDIA GPU (docker run --gpus all). See README.md.
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg build-essential && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir voxcpm faster-whisper soundfile resemblyzer
WORKDIR /work
