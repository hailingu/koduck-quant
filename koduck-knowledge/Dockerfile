ARG ARTIFACT_IMAGE=koduck-knowledge-build:jvm
ARG JAVA_RUNTIME_IMAGE=eclipse-temurin:23-jre
ARG NATIVE_RUNTIME_IMAGE=debian:bookworm-slim

FROM ${ARTIFACT_IMAGE} AS artifact

FROM ${JAVA_RUNTIME_IMAGE} AS jvm-runtime

WORKDIR /app
ENV LOGGING_CONFIG=file:/app/config/log4j2.xml

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    if ! getent group koduck >/dev/null; then groupadd --system koduck; fi && \
    if ! id -u koduck >/dev/null 2>&1; then useradd --system --create-home --gid koduck --shell /usr/sbin/nologin koduck; fi

COPY --from=artifact /artifacts/app.jar /app/koduck-knowledge.jar
COPY docker/log4j2.xml /app/config/log4j2.xml
COPY docker/log4j2-event-template.json /app/config/log4j2-event-template.json

USER koduck

EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8084/actuator/health/readiness || exit 1

ENTRYPOINT ["java", "-Dlogging.config=file:/app/config/log4j2.xml", "-Dlog4j2.configurationFile=file:/app/config/log4j2.xml", "-jar", "/app/koduck-knowledge.jar"]

FROM ${NATIVE_RUNTIME_IMAGE} AS native-runtime

WORKDIR /app
ENV LOGGING_CONFIG=file:/app/config/log4j2.xml

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/* && \
    if ! getent group koduck >/dev/null; then groupadd --system koduck; fi && \
    if ! id -u koduck >/dev/null 2>&1; then useradd --system --create-home --gid koduck --shell /usr/sbin/nologin koduck; fi

COPY --from=artifact /artifacts/koduck-knowledge /app/koduck-knowledge
COPY docker/log4j2.xml /app/config/log4j2.xml
COPY docker/log4j2-event-template.json /app/config/log4j2-event-template.json

RUN chown -R koduck:koduck /app && chmod +x /app/koduck-knowledge

USER koduck

EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8084/actuator/health/readiness || exit 1

ENTRYPOINT ["/app/koduck-knowledge", "-Dlogging.config=file:/app/config/log4j2.xml", "-Dlog4j2.configurationFile=file:/app/config/log4j2.xml"]
