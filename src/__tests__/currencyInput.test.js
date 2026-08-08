import assert from 'node:assert/strict';
import { sanitizeDecimal, sanitizeDigits } from '../utils/currencyUtils.js';

assert.equal(sanitizeDigits('12abc.345 ₫'), '12345');
assert.equal(sanitizeDigits('123456', 4), '1234');
assert.equal(sanitizeDigits(''), '');

assert.equal(sanitizeDecimal('12,5%'), '12.5');
assert.equal(sanitizeDecimal('1.2.3abc'), '1.23');
assert.equal(sanitizeDecimal('.75'), '0.75');
assert.equal(sanitizeDecimal('1234567.89123', 6, 4), '123456.8912');
assert.equal(sanitizeDecimal(''), '');

console.log('currency input tests passed');
