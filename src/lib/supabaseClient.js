// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://udboqmxdbazqqjqawmoi.supabase.co'; // Your actual Supabase URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkYm9xbXhkYmF6cXFqcWF3bW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMjMyMzgsImV4cCI6MjA3MTc5OTIzOH0.6TfRnjRAuaHLXu4uOg1ypjkH3SNqa5b5QBZZVY0B7Zw'; // Your actual Supabase Anon Key

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
