-- ==========================================
-- Koduck Quant Database Initialization
-- ==========================================

-- Create database if not exists (for docker initialization)
-- Note: This script runs after the database is created by PostgreSQL

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application schemas if needed
-- CREATE SCHEMA IF NOT EXISTS koduck;

-- Set default timezone
SET TIMEZONE = 'Asia/Shanghai';

-- ==========================================
-- Initial Data (Optional)
-- ==========================================

-- Add any initial data here if needed
-- For example: default admin user, system configuration, etc.

-- Note: Flyway will handle schema migrations and seed data
-- See koduck-backend/src/main/resources/db/migration/

-- Grant privileges
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO koduck;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO koduck;
