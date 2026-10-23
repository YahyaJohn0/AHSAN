import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductRecord } from '../services/rtdb.ts';

test('normalizeProductRecord handles empty or null payload safely', () => {
  const product = normalizeProductRecord('test-id-1', null);
  assert.equal(product.id, 'test-id-1');
  assert.equal(product.price, 0);
  assert.equal(product.stock, 0);
  assert.equal(product.isActive, true);
  assert.equal(product.isFeatured, false);
  assert.ok(Array.isArray(product.images));
});

test('normalizeProductRecord preserves Cloudinary URLs and metadata', () => {
  const rawDemo = {
    id: 'demo-biocos-beauty-cream',
    name: 'Biocos Beauty Cream with Serum',
    price: 350,
    salePrice: 299,
    stock: 25,
    category: 'Beauty Creams',
    imageUrl: 'https://res.cloudinary.com/dqtawjwph/image/upload/v1792471736/zamzam/demo-products/beauty-creams/demo-biocos-beauty-cream.jpg',
    images: [
      'https://res.cloudinary.com/dqtawjwph/image/upload/v1792471736/zamzam/demo-products/beauty-creams/demo-biocos-beauty-cream.jpg'
    ],
    isFeatured: true,
    isBestSeller: true
  };

  const product = normalizeProductRecord('demo-biocos-beauty-cream', rawDemo);

  assert.equal(product.id, 'demo-biocos-beauty-cream');
  assert.equal(product.name, 'Biocos Beauty Cream with Serum');
  assert.equal(product.price, 350);
  assert.equal(product.salePrice, 299);
  assert.equal(product.stock, 25);
  assert.equal(product.isFeatured, true);
  assert.equal(product.isBestSeller, true);
  assert.equal(product.images[0], 'https://res.cloudinary.com/dqtawjwph/image/upload/v1792471736/zamzam/demo-products/beauty-creams/demo-biocos-beauty-cream.jpg');
});

test('normalizeProductRecord parses string formatted prices and stock', () => {
  const raw = {
    name: 'Relumin Cream',
    price: '1400',
    salePrice: '1250',
    stock: '15'
  };

  const product = normalizeProductRecord('demo-relumin', raw);
  assert.equal(product.price, 1400);
  assert.equal(product.salePrice, 1250);
  assert.equal(product.stock, 15);
});
