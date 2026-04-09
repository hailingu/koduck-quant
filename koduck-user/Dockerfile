# Multi-stage build for koduck-user
# Build from service directory context:
#   docker build -t koduck-user:dev ./koduck-user

# Stage 1: Builder
FROM maven:3.9.9-eclipse-temurin-23 AS builder

WORKDIR /app
ARG MAVEN_MIRROR_URL=https://maven.aliyun.com/repository/public

# Use a configurable Maven mirror to speed up dependency downloads.
RUN mkdir -p /root/.m2 && \
    printf '%s\n' \
    '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"' \
    '          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' \
    '          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">' \
    '  <mirrors>' \
    '    <mirror>' \
    '      <id>mirror</id>' \
    '      <name>Custom Maven Mirror</name>' \
    '      <url>'"${MAVEN_MIRROR_URL}"'</url>' \
    '      <mirrorOf>*</mirrorOf>' \
    '    </mirror>' \
    '  </mirrors>' \
    '</settings>' > /root/.m2/settings.xml

# Copy pom first for better layer caching
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2/repository \
    mvn -s /root/.m2/settings.xml -B dependency:go-offline -q

# Copy source and build
COPY src ./src

RUN --mount=type=cache,target=/root/.m2/repository \
    mvn -s /root/.m2/settings.xml -B -DskipTests package -q

# Extract layered JAR for smaller runtime image
RUN java -Djarmode=layertools -jar target/*.jar extract --destination extracted

# Stage 2: Runtime
FROM eclipse-temurin:23-jre

WORKDIR /app

# Install runtime tools and create non-root user
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    if ! getent group koduck >/dev/null; then groupadd --system koduck; fi && \
    if ! id -u koduck >/dev/null 2>&1; then useradd --system --create-home --gid koduck --shell /usr/sbin/nologin koduck; fi

# Copy layered application (dependencies layer cached across builds)
COPY --from=builder /app/extracted/dependencies/ ./
COPY --from=builder /app/extracted/spring-boot-loader/ ./
COPY --from=builder /app/extracted/snapshot-dependencies/ ./
COPY --from=builder /app/extracted/application/ ./

# Create directories for runtime data
RUN mkdir -p /app/avatars && \
    chown -R koduck:koduck /app

USER koduck

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8082/actuator/health || exit 1

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
