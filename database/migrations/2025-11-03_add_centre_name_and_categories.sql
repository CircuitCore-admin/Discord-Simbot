-- File: database/migrations/2025-11-03_add_centre_name_and_categories.sql

-- 1. Add the new 'centre_name' column to the existing 'hotlaps' table
-- This will store the formatted channel name (e.g., "Confetti Institute")
ALTER TABLE public.hotlaps
ADD COLUMN centre_name TEXT NULL;

-- 2. Create a table to store the category IDs for the special guild
CREATE TABLE public.special_hotlap_categories (
    category_id TEXT PRIMARY KEY NOT NULL
);

-- 3. Pre-populate the table with the initial specified categories
INSERT INTO public.special_hotlap_categories (category_id) 
VALUES 
('1285999601496887367'),
('1049282296529817691');
