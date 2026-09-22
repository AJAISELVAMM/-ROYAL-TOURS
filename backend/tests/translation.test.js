import { api } from './helpers.js';

describe('Translation', () => {
  it('translates supported text', async () => {
    const res = await api().post('/api/translation/translate').send({
      text: 'how much is the taxi?',
      targetLanguage: 'ta'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.targetLanguage).toBe('ta');
    expect(res.body.data.translated).toBeTruthy();
  });

  it('lists supported languages', async () => {
    const res = await api().get('/api/translation/languages');
    expect(res.status).toBe(200);
    expect(res.body.data.languages.map((l) => l.code)).toEqual(
      expect.arrayContaining(['en', 'ta', 'hi', 'ml', 'kn', 'te'])
    );
  });

  it('rejects an unsupported target language', async () => {
    const res = await api().post('/api/translation/translate').send({
      text: 'hello',
      targetLanguage: 'fr'
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty text', async () => {
    const res = await api().post('/api/translation/translate').send({ text: '', targetLanguage: 'hi' });
    expect(res.status).toBe(400);
  });
});
