-- Migration: Merge family.parents into family.helper, move learning subcategories to personal (v6.16.2)

-- 1. Merge 'Chi cho bố mẹ' (family.parents) into 'Chi cho người thân' (family.helper)
UPDATE finance_transactions
SET subcategory_id = 'family.helper'
WHERE subcategory_id = 'family.parents';

UPDATE finance_recurring_bills
SET subcategory_id = 'family.helper'
WHERE subcategory_id = 'family.parents';

UPDATE finance_budget_targets
SET subcategory_id = 'family.helper'
WHERE subcategory_id = 'family.parents';

UPDATE finance_shortcuts
SET subcategory_id = 'family.helper'
WHERE subcategory_id = 'family.parents';

-- 2. Move existing records with learning subcategories from 'family' to 'personal'
UPDATE finance_transactions
SET category_id = 'personal'
WHERE category_id = 'family'
  AND subcategory_id IN ('family.tuition', 'family.books', 'family.course');

UPDATE finance_recurring_bills
SET category_id = 'personal'
WHERE category_id = 'family'
  AND subcategory_id IN ('family.tuition', 'family.books', 'family.course');

UPDATE finance_shortcuts
SET category_id = 'personal'
WHERE category_id = 'family'
  AND subcategory_id IN ('family.tuition', 'family.books', 'family.course');
