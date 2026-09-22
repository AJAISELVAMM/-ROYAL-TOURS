const test = async () => {
  const cases = [
    { text: 'Hello', sourceLanguage: 'English', targetLanguage: 'Hindi' },
    { text: 'Where is the hotel?', sourceLanguage: 'English', targetLanguage: 'Tamil' },
    { text: 'How much does this cost?', sourceLanguage: 'English', targetLanguage: 'Telugu' },
    { text: 'Thank you', sourceLanguage: 'English', targetLanguage: 'Malayalam' },
    { text: 'Where is the airport?', sourceLanguage: 'English', targetLanguage: 'Kannada' }
  ];

  console.log('--- TESTING TRANSLATION ENDPOINTS ---');
  for (const c of cases) {
    const res = await fetch('http://localhost:5000/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    });
    const json = await res.json();
    const out = json.data?.translatedText || json.translatedText || JSON.stringify(json);
    console.log(`${c.sourceLanguage} -> ${c.targetLanguage} ("${c.text}") ==> ${out}`);
  }
};

test();
