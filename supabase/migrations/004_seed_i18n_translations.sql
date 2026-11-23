-- ============================================================================
-- W Automobiles — Seed Draft EN / AR Translations for Existing Vehicles
-- Migration: 004_seed_i18n_translations.sql
--
-- STATUS: DRAFT TRANSLATIONS — NEEDS NATIVE REVIEW
--
-- Run AFTER 002_i18n.sql in the Supabase SQL Editor.
-- Idempotent: updates EN/AR fields by slug ONLY on existing rows, never
-- touching images, price, featured, or published flags.
-- Covers the 6 showroom vehicles from 003_seed_6_showroom_cars.sql AND any
-- sample vehicles seeded from data/cars.json.
-- ============================================================================

-- 1. Audi Q5 Sportback S-Line 40 TDI (2025) [draft, needs native review]
update public.cars
set
  description_en = 'Brand-new vehicle (0 km), full S-Line exterior and interior styling, Quattro all-wheel drive. Ready for immediate delivery with registration card and complete paperwork.',
  description_ar = 'سيارة جديدة كلياً (0 كم)، فئة S-Line الخارجية والداخلية الكاملة مع نظام الدفع الرباعي Quattro. جاهزة للتسليم الفوري مع البطاقة الرمادية والملف الكامل.',
  features_en = array[
    'Panoramic sunroof',
    'Matrix LED headlights',
    '360° camera',
    'Heated seats',
    'Apple CarPlay / Android Auto',
    'Virtual Cockpit'
  ],
  features_ar = array[
    'سقف بانورامي قابل للفتح',
    'مصابيح Matrix LED',
    'كاميرا 360 درجة',
    'مقاعد مدفأة',
    'Apple CarPlay / Android Auto',
    'شاشة عدادات رقمية Virtual Cockpit'
  ],
  updated_at = now()
where slug = 'audi-q5-sportback-sline-2025';

-- 2. Volkswagen Golf 8 2.0 TDI R-Line (2025) [draft, needs native review]
update public.cars
set
  description_en = 'New Golf 8 with full R-Line package, 18-inch Bergamo alloy wheels, 30-color ambient lighting, and Harman Kardon sound system.',
  description_ar = 'غولف 8 الجديدة بباقة R-Line الكاملة، جنوط ألمنيوم Bergamo مقاس 18 بوصة، إضاءة محيطية بـ 30 لوناً ونظام صوتي Harman Kardon.',
  features_en = array[
    'Adaptive cruise control',
    'Apple CarPlay / Android Auto',
    'Automatic climate control',
    'Parking sensors',
    'IQ.Light LED headlights'
  ],
  features_ar = array[
    'مثبت سرعة تكيفي',
    'Apple CarPlay / Android Auto',
    'تكييف أوتوماتيكي',
    'حساسات ركن',
    'مصابيح IQ.Light LED'
  ],
  updated_at = now()
where slug = 'volkswagen-golf-8-rline-2025';

-- 3. Mercedes-Benz Classe C 220d AMG Line (2024) [draft, needs native review]
update public.cars
set
  description_en = 'Immaculate condition, accident-free, original paintwork. AMG Line interior and exterior package, MBUX central touchscreen, and panoramic sunroof.',
  description_ar = 'حالة ممتازة جداً، بدون حوادث وطلاء أصلي بالكامل. باقة AMG الداخلية والخارجية، شاشة MBUX وسطية باللمس وسقف بانورامي قابل للفتح.',
  features_en = array[
    'Leather seats',
    '360° camera',
    'Panoramic sunroof',
    'Apple CarPlay / Android Auto',
    'Head-Up Display',
    '19" AMG alloy wheels'
  ],
  features_ar = array[
    'مقاعد جلدية',
    'كاميرا 360 درجة',
    'سقف بانورامي قابل للفتح',
    'Apple CarPlay / Android Auto',
    'شاشة عرض على الزجاج الأمامي',
    'جنوط AMG ألمنيوم مقاس 19 بوصة'
  ],
  updated_at = now()
where slug = 'mercedes-classe-c-220d-amg-2024';

-- 4. Volkswagen Tiguan 2.0 TDI R-Line (2025) [draft, needs native review]
update public.cars
set
  description_en = 'All-new Tiguan R-Line 4Motion, large 15-inch central display, DCC Pro adaptive suspension, and premium cabin finishes.',
  description_ar = 'تيغوان R-Line 4Motion الجديدة، شاشة وسطية كبيرة مقاس 15 بوصة، نظام تعليق متكيف DCC Pro وتشطيبات داخلية فاخرة.',
  features_en = array[
    'Panoramic sunroof',
    '360° camera',
    'Massaging and heated seats',
    'Adaptive cruise control',
    'Power tailgate'
  ],
  features_ar = array[
    'سقف بانورامي قابل للفتح',
    'كاميرا 360 درجة',
    'مقاعد بالتدليك والتدفئة',
    'مثبت سرعة تكيفي',
    'باب صندوق خلفي كهربائي'
  ],
  updated_at = now()
where slug = 'volkswagen-tiguan-rline-2025';

-- 5. Porsche Macan S PDK (2024) [draft, needs native review]
update public.cars
set
  description_en = 'Exclusive Chalk Grey configuration with black leather interior and contrast stitching, Sport Chrono Package, sport exhaust, and 21-inch RS Spyder wheels.',
  description_ar = 'مواصفات حصرية باللون الرمادي الطباشيري مع مقصورة جلدية سوداء وتطريز متباين، باقة Sport Chrono، عادم رياضي وجنوط RS Spyder مقاس 21 بوصة.',
  features_en = array[
    'Sport Chrono Package',
    'PASM air suspension',
    'BOSE Surround Sound System',
    '360° camera',
    'Panoramic sunroof',
    'Leather seats'
  ],
  features_ar = array[
    'باقة Sport Chrono',
    'نظام تعليق هوائي PASM',
    'نظام صوتي BOSE',
    'كاميرا 360 درجة',
    'سقف بانورامي قابل للفتح',
    'مقاعد جلدية'
  ],
  updated_at = now()
where slug = 'porsche-macan-s-2024';

-- 6. Cupra Formentor VZ (2025) [draft, needs native review]
update public.cars
set
  description_en = 'Brand-new sporty coupe-SUV with Brembo brakes, genuine leather Cupra bucket seats, copper accents, and dynamic 4Drive all-wheel drive.',
  description_ar = 'سيارة SUV كوبيه رياضية جديدة، مكابح Brembo، مقاعد رياضية حاضنة من الجلد الطبيعي بلمسات نحاسية ونظام دفع رباعي ديناميكي 4Drive.',
  features_en = array[
    'Leather bucket seats',
    '360° camera',
    'Apple CarPlay / Android Auto',
    'Adaptive cruise control',
    '3-zone automatic climate control'
  ],
  features_ar = array[
    'مقاعد رياضية جلدية حاضنة',
    'كاميرا 360 درجة',
    'Apple CarPlay / Android Auto',
    'مثبت سرعة تكيفي',
    'تكييف أوتوماتيكي بـ 3 مناطق'
  ],
  updated_at = now()
where slug = 'cupra-formentor-vz-2025';
