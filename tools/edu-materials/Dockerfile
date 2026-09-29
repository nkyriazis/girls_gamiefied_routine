# Tools image for tools/edu-materials: Python + poppler (pdftotext) for text extraction.
FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils \
 && rm -rf /var/lib/apt/lists/*
