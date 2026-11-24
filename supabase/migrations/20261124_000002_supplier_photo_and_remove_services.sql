-- Migration 2: Add invoice_photo_url to purchase_invoices, add Supabase storage bucket, and drop services_income

-- 1. إضافة عمود صورة الفاتورة لفواتير المشتريات والتوريد
ALTER TABLE IF EXISTS purchase_invoices 
ADD COLUMN IF NOT EXISTS invoice_photo_url TEXT;

-- 2. إزالة عمود cash_services من جلسات الدرج
ALTER TABLE IF EXISTS drawer_sessions 
DROP COLUMN IF EXISTS cash_services;

-- 3. حذف جدول إيرادات الخدمات بعد تحويل كافة الخدمات (نسخ المفاتيح، البرمجة، الإيموبلايزر) لمنتجات ذات تكلفة ومخزون
DROP TABLE IF EXISTS services_income CASCADE;

-- 4. إعداد حاوية تخزين Supabase Storage لمرفقات وصور فواتير التوريد
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoice-attachments', 'invoice-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 5. سياسة الأمان لحاوية صور الفواتير في Supabase Storage
DROP POLICY IF EXISTS "Allow authenticated shop users to upload invoice photos" ON storage.objects;
CREATE POLICY "Allow authenticated shop users to upload invoice photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoice-attachments');

DROP POLICY IF EXISTS "Allow public read access for invoice photos" ON storage.objects;
CREATE POLICY "Allow public read access for invoice photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoice-attachments');
