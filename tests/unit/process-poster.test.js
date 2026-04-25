/**
 * @jest-environment node
 */

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: { upload: jest.fn() },
  },
}));

jest.mock('formidable', () =>
  jest.fn(() => ({
    parse: jest.fn(),
  }))
);

const cloudinary = require('cloudinary').v2;
const formidable = require('formidable');
const { handler } = require('../../netlify/functions/process-poster');

const REQUIRED_ENV = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

function setEnv() {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
}

function clearEnv() {
  for (const key of REQUIRED_ENV) delete process.env[key];
}

describe('process-poster handler', () => {
  beforeEach(() => {
    cloudinary.uploader.upload.mockReset();
    formidable.mockClear();
  });

  test('rejects non-POST methods with 405', async () => {
    const result = await handler({ httpMethod: 'GET' });
    expect(result.statusCode).toBe(405);
  });

  test('returns 200 OK on OPTIONS preflight', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' });
    expect(result.statusCode).toBe(200);
  });

  test('returns 500 when Cloudinary env vars are missing', async () => {
    clearEnv();
    const result = await handler({ httpMethod: 'POST', body: '' });
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Environment configuration error/i);
    expect(body.message).toMatch(/CLOUDINARY/);
  });

  test('returns 400 when no file is uploaded', async () => {
    setEnv();
    formidable.mockReturnValueOnce({
      parse: (event, cb) => cb(null, {}, {}),
    });

    const result = await handler({ httpMethod: 'POST' });
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/No file uploaded/i);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  test('uploads the parsed file to Cloudinary on success', async () => {
    setEnv();
    formidable.mockReturnValueOnce({
      parse: (event, cb) =>
        cb(null, {}, {
          poster: { filepath: '/tmp/test.jpg', originalFilename: 'test.jpg' },
        }),
    });
    cloudinary.uploader.upload.mockResolvedValueOnce({
      public_id: 'event_posters/abc',
      secure_url: 'https://res.cloudinary.com/test/image/upload/abc.jpg',
    });

    const result = await handler({ httpMethod: 'POST' });

    expect(cloudinary.uploader.upload).toHaveBeenCalledTimes(1);
    const [filepath, options] = cloudinary.uploader.upload.mock.calls[0];
    expect(filepath).toBe('/tmp/test.jpg');
    expect(options.folder).toBe('event_posters');
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  test('returns 400 when formidable fails to parse', async () => {
    setEnv();
    formidable.mockReturnValueOnce({
      parse: (event, cb) => cb(new Error('Bad multipart')),
    });

    const result = await handler({ httpMethod: 'POST' });
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toMatch(/Bad multipart/);
  });
});
