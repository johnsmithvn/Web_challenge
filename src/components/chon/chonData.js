/**
 * Dữ liệu tĩnh của Chốn đã đánh chỉ mục để component tra nhanh (src/data/place-kinds.json).
 * Nhãn danh mục Tài chính lấy từ finance-categories.json — nguồn duy nhất của tên danh mục.
 */
import placeData from '../../data/place-kinds.json';
import financeCats from '../../data/finance-categories.json';
import { deriveNecessity } from '../../utils/financeLogic';

export const KINDS = placeData.kinds;
export const OCCASIONS = placeData.occasions;
export const REVISITS = placeData.revisit;
export const PLATFORMS = placeData.platforms;

const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
export const KIND = byId(KINDS);
export const OCCASION = byId(OCCASIONS);
export const PLATFORM = byId(PLATFORMS);

export const kindOf = id => KIND[id] || KIND.other;

/**
 * Danh mục Tài chính khi thắp đèn một chốn loại `kindId`.
 * @returns {{ category_id, subcategory_id, necessity, label }}
 */
export function financeFor(kindId) {
  const { category, sub } = kindOf(kindId).finance;
  const group = financeCats.expenseGroups.find(g => g.key === category);
  const subLabel = sub ? group?.subs.find(s => s.key === sub)?.label : null;
  return {
    category_id: category,
    subcategory_id: sub,
    necessity: deriveNecessity(category, sub, financeCats),
    label: subLabel || group?.label || 'Khác',
  };
}
