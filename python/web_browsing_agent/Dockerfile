# The builder image, used to build the virtual environment
FROM --platform=linux/amd64 mcr.microsoft.com/playwright/python:v1.49.1

WORKDIR /app

# Install uv tool 
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin:$PATH"

COPY pyproject.toml uv.lock ./

RUN uv sync --locked --no-dev
RUN uv add gunicorn

ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

COPY src/ ./

EXPOSE 3978

ENV VIRTUAL_ENV=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"
ENV IS_DOCKER_ENV=true

# Use Gunicorn as the web server because azure app service needs it
CMD ["gunicorn", "--bind", "0.0.0.0:3978", "--worker-class", "aiohttp.worker.GunicornWebWorker", "--timeout", "600", "app:app"]