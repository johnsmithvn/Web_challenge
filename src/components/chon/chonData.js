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
 * Vị trí cố định (position: fixed) cho popover mở từ nút `el` — thoát khỏi vùng cuộn của sheet nên không kéo dài
 * khung. Canh giữa nút, kẹp trong màn hình. Điện thoại: datepicker.css tự đưa popover xuống đáy (bỏ qua toạ độ).
 */
export function popoverAt(el, width = 320) {
  const r = el.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
  return { position: 'fixed', top: Math.round(r.bottom + 6), left: Math.round(Math.max(8, left)), zIndex: 1300 };
}

/** Bộ danh mục mặc định — dùng khi chưa đọc được tuỳ chỉnh của user. */
export const DEFAULT_FINANCE_CATS = financeCats;

/**
 * Danh mục Tài chính khi thắp đèn một chốn loại `kindId` (hoặc chốt chuyến: 'travel').
 * @param cats — bộ danh mục đã ghép tuỳ chỉnh của user (mergeCategoryOverrides); mặc định = bản gốc.
 *   Danh mục con mặc định mà user đã bỏ khỏi nhóm → chỉ ghi theo nhóm.
 * @returns {{ category_id, subcategory_id, necessity, label }}
 */
export function financeFor(kindId, cats = financeCats) {
  const { category, sub: defaultSub } = kindOf(kindId).finance;
  const group = (cats.expenseGroups || []).find(g => g.key === category);
  const subRow = defaultSub ? (group?.subs || []).find(s => s.key === defaultSub) : null;
  const sub = subRow ? defaultSub : null;
  return {
    category_id: category,
    subcategory_id: sub,
    necessity: deriveNecessity(category, sub, cats),
    label: subRow?.label || group?.label || 'Khác',
  };
}
