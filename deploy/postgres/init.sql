-- Create umami database for analytics
-- This script runs only on first PostgreSQL volume initialization.
-- If adding Umami to an existing installation, manually create the DB:
--   docker exec -it dabb-postgres psql -U dabb -c "CREATE DATABASE umami;"
CREATE DATABASE umami;
