import React, { useState, useEffect, useRef } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as translationService from '../../services/translationService.js';

const QUICK_PHRASES = [
  'Where is the nearest hospital?',
  'How much is the fare to the railway station?',
  'I need immediate police assistance.',
  'Can you please help me find this address?',
  'Where is the nearest pharmacy or doctor?',
  'Is there a vegetarian restaurant nearby?'
];

const SPEECH_LANG_MAP = {
  en: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
  ml: 'ml-IN',
  kn: 'kn-IN',
  te: 'te-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
  or: 'or-IN',
  as: 'as-IN'
};

export default function TranslatorView() {
  const { push } = useToast();

  const [languages, setLanguages] = useState(translationService.LANGUAGES);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ta');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef(null);
  const abortCtrlRef = useRef(null);

  useEffect(() => {
    translationService
      .getLanguages()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setLanguages(list);
        }
      })
      .catch(() => {});
    return () => {
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
    };
  }, []);

  async function handleTranslate(textToTranslate) {
    if (loading) return;
    const text = (textToTranslate || sourceText).trim();
    if (!text) {
      push('Please enter text to translate.', 'info', { id: 'trans-empty' });
      return;
    }

    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;

    setLoading(true);
    setError(null);

    try {
      const result = await translationService.translate(text, targetLang, sourceLang);
      setTranslatedText(result || '');
    } catch (err) {
      if (err.name === 'AbortError' || abortCtrl.signal.aborted) return;
      const fallbackMsg = err?.message || 'Translation service is temporarily unavailable. Please try again.';
      setError(fallbackMsg);
      push(fallbackMsg, 'error', { id: 'translation-error' });
    } finally {
      setLoading(false);
    }
  }

  // Voice Input via Web Speech API
  function toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      push('Speech recognition is not supported in this browser.', 'error');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = SPEECH_LANG_MAP[sourceLang] || 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        push('Listening… Speak into your microphone.', 'info');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setSourceText(transcript);
          handleTranslate(transcript);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        push(`Speech error: ${event.error}`, 'error');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      push('Could not start speech recognition.', 'error');
    }
  }

  // Voice Output via Web Speech Synthesis
  function speakText(text, langCode) {
    if (!('speechSynthesis' in window)) {
      push('Speech synthesis is not supported in this browser.', 'error');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!text?.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG_MAP[langCode] || 'en-IN';
    utterance.rate = 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  function swapLanguages() {
    const s = sourceLang;
    const t = targetLang;
    setSourceLang(t);
    setTargetLang(s);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  }

  return (
    <div className="translator-view">
      <Card>
        <h2>AI Multilingual Translator</h2>
        <p className="section-sub">
          Instant real-time translation across 13 Indian languages with native voice input & speech synthesis.
        </p>

        {/* Language Selection Header */}
        <div className="translator-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <div className="select-wrap" style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>From</label>
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="select-input">
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={swapLanguages}
            title="Swap Languages"
            style={{ marginTop: '18px', width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="repeat" size={16} />
          </button>

          <div className="select-wrap" style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>To</label>
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="select-input">
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Translation Translation Textareas */}
        <div className="translator-boxes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '18px' }}>
          <div className="trans-box">
            <textarea
              className="trans-textarea"
              rows={5}
              placeholder="Type or speak text in English or regional language…"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
            <div className="trans-box-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${isListening ? 'btn-danger' : 'btn-outline'}`}
                  onClick={toggleSpeechRecognition}
                  title="Voice Input"
                >
                  <Icon name="mic" size={15} /> {isListening ? 'Listening…' : 'Voice Input'}
                </button>
                {sourceText && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setSourceText('');
                      setTranslatedText('');
                    }}
                    title="Clear Text"
                  >
                    <Icon name="x" size={15} /> Clear
                  </button>
                )}
              </div>
              <Button size="sm" variant="primary" icon="sparkles" disabled={loading} onClick={() => handleTranslate()}>
                {loading ? 'Translating…' : 'Translate'}
              </Button>
            </div>
          </div>

          <div className="trans-box trans-result-box" style={{ background: error ? 'var(--red-soft, #fef2f2)' : 'var(--purple-50)', borderRadius: '12px', padding: '12px', border: error ? '1px solid #fca5a5' : '1px solid var(--border)' }}>
            <div style={{ minHeight: '120px', fontSize: '15px', lineHeight: '1.6', color: error ? '#991b1b' : 'var(--text)' }}>
              {error ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                  <Icon name="alert-circle" size={18} />
                  <span>{error}</span>
                </div>
              ) : translatedText ? (
                translatedText
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Translated text will appear here…</span>
              )}
            </div>
            {translatedText && (
              <div className="trans-box-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => speakText(translatedText, targetLang)}
                  title="Speak Translation"
                >
                  <Icon name="volume-2" size={15} /> {isSpeaking ? 'Speaking…' : 'Listen'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    navigator.clipboard.writeText(translatedText);
                    push('Copied to clipboard', 'success');
                  }}
                  title="Copy Translation"
                >
                  <Icon name="copy" size={15} /> Copy
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Essential Tourist Phrases */}
        <div style={{ marginTop: '28px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Quick Essential Tourist Phrases
          </h3>
          <div className="phrase-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                className="filter-chip"
                style={{ fontSize: '12.5px', padding: '6px 12px' }}
                onClick={() => {
                  setSourceText(phrase);
                  setSourceLang('en');
                  handleTranslate(phrase);
                }}
              >
                💬 {phrase}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
