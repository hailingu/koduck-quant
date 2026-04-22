# ==========================================
# Koduck Backend Dockerfile - Multi-Module
# Spring Boot 3.4.2 + Java 23
# ==========================================

# Stage 1: Build the application
FROM maven:3.9.9-eclipse-temurin-23-alpine AS builder

# Set working directory
WORKDIR /build

# Copy root pom.xml first for better layer caching
COPY pom.xml .

# Copy all module pom.xml files to leverage dependency caching
# This layer will be cached if pom.xml files don't change
COPY koduck-bom/pom.xml koduck-bom/
COPY koduck-common/pom.xml koduck-common/
COPY koduck-infrastructure/pom.xml koduck-infrastructure/
COPY koduck-core/pom.xml koduck-core/
COPY koduck-bootstrap/pom.xml koduck-bootstrap/

# Copy aggregator module pom.xml files (parent poms for sub-modules)
COPY koduck-market/pom.xml koduck-market/
COPY koduck-portfolio/pom.xml koduck-portfolio/
COPY koduck-strategy/pom.xml koduck-strategy/
COPY koduck-community/pom.xml koduck-community/

# Copy API module pom.xml files
COPY koduck-market/koduck-market-api/pom.xml koduck-market/koduck-market-api/
COPY koduck-portfolio/koduck-portfolio-api/pom.xml koduck-portfolio/koduck-portfolio-api/
COPY koduck-strategy/koduck-strategy-api/pom.xml koduck-strategy/koduck-strategy-api/
COPY koduck-community/koduck-community-api/pom.xml koduck-community/koduck-community-api/

# Copy Impl module pom.xml files
COPY koduck-market/koduck-market-impl/pom.xml koduck-market/koduck-market-impl/
COPY koduck-portfolio/koduck-portfolio-impl/pom.xml koduck-portfolio/koduck-portfolio-impl/
COPY koduck-strategy/koduck-strategy-impl/pom.xml koduck-strategy/koduck-strategy-impl/
COPY koduck-community/koduck-community-impl/pom.xml koduck-community/koduck-community-impl/

# Copy source code
COPY . .

# Build the application with Maven cache
# Use BuildKit cache mount to persist downloaded dependencies
RUN --mount=type=cache,target=/root/.m2 \
    mvn clean package -pl koduck-bootstrap -am \
    -DskipTests -Dcheckstyle.skip=true -Dmaven.test.skip=true -B

# Stage 2: Create the runtime image
FROM eclipse-temurin:23-jre-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -S koduck && adduser -S koduck -G koduck

# Set working directory
WORKDIR /app

# Copy the built JAR from builder stage
# The bootstrap module contains the executable JAR
COPY --from=builder /build/koduck-bootstrap/target/*.jar app.jar

# Change ownership to non-root user
RUN chown -R koduck:koduck /app

# Switch to non-root user
USER koduck

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health || exit 1

# JVM options for containerized environment
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0 -Djava.security.egd=file:/dev/./urandom"

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
