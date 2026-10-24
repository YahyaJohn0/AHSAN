import test from 'node:test';
import assert from 'node:assert/strict';
import { generateUploadSignature, verifyCloudinaryImageUrl } from '../../backend/cloudinary.ts';
import { storeMongoImage, getMongoImages, deleteMongoImage } from '../../backend/mongo.ts';

test('generateUploadSignature generates correct timestamp and signature structure', () => {
  const result = generateUploadSignature({ folder: 'samples/ecommerce' });
  assert.ok(result.timestamp > 0);
  assert.ok(typeof result.signature === 'string');
  assert.ok(result.signature.length > 0);
  assert.ok(typeof result.apiKey === 'string');
  assert.ok(typeof result.cloudName === 'string');
});

test('verifyCloudinaryImageUrl identifies valid Cloudinary HTTPS URLs', async () => {
  const validUrl = 'https://res.cloudinary.com/dqtawjwph/image/upload/v1792471736/zamzam/demo-products/beauty-creams/demo-biocos-beauty-cream.jpg';
  const result = await verifyCloudinaryImageUrl(validUrl);
  assert.equal(result.valid, true);
  assert.equal(result.url, validUrl);

  const invalidUrl = 'not-a-valid-url';
  const invalidResult = await verifyCloudinaryImageUrl(invalidUrl);
  assert.equal(invalidResult.valid, false);
});

test('storeMongoImage persists Cloudinary image metadata and retrieves URL correctly', async () => {
  const testImage = {
    url: 'https://res.cloudinary.com/dqtawjwph/image/upload/v1792471736/zamzam/test-cream.jpg',
    secureUrl: 'https://res.cloudinary.com/dqtawjwph/image/upload/v1792471736/zamzam/test-cream.jpg',
    publicId: 'samples/ecommerce/test-cream-unit',
    format: 'jpg',
    width: 800,
    height: 800,
    bytes: 45000,
    associatedProductId: 'prod-test-unit'
  };

  const stored = await storeMongoImage(testImage);
  assert.ok(stored);
  assert.equal(stored.secureUrl, testImage.secureUrl);
  assert.equal(stored.publicId, testImage.publicId);
  assert.equal(stored.source, 'cloudinary');
  assert.equal(stored.verified, true);
});
