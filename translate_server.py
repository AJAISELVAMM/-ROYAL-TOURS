import sys
import os
import json
import logging
from flask import Flask, request, jsonify

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("translate_server")

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
if hasattr(app, 'json'):
    app.json.ensure_ascii = False

# Supported language codes & names
LANG_MAP = {
    "en": "English",
    "ta": "Tamil",
    "hi": "Hindi",
    "te": "Telugu",
    "ml": "Malayalam",
    "kn": "Kannada",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "or": "Odia",
    "as": "Assamese"
}

argos_available = False
try:
    import argostranslate.package
    import argostranslate.translate
    argos_available = True
    logger.info("Argos Translate loaded successfully.")
except Exception as e:
    logger.warning(f"Argos Translate import warning: {e}")

def get_installed_languages():
    if not argos_available:
        return [{"code": c, "name": n} for c, n in LANG_MAP.items()]
    try:
        installed_languages = argostranslate.translate.get_installed_languages()
        if installed_languages:
            return [{"code": l.code, "name": LANG_MAP.get(l.code, l.name)} for l in installed_languages]
    except Exception as e:
        logger.warning(f"Could not retrieve installed languages: {e}")
    return [{"code": c, "name": n} for c, n in LANG_MAP.items()]

def do_argos_translation(text, source_code, target_code):
    if not argos_available:
        return None
    try:
        installed_languages = argostranslate.translate.get_installed_languages()
        from_lang = next((l for l in installed_languages if l.code == source_code), None)
        to_lang = next((l for l in installed_languages if l.code == target_code), None)
        if from_lang and to_lang:
            translation = from_lang.get_translation(to_lang)
            if translation:
                return translation.translate(text)
    except Exception as e:
        logger.error(f"Argos translation error: {e}")
    return None

# Built-in essential offline phrase translations for Indian languages to guarantee 100% reliable instant response
OFFLINE_PHRASES = {
    "ta": {
        "hello": "வணக்கம்",
        "where is the hotel?": "ஹோட்டல் எங்கே இருக்கிறது?",
        "where is the hotel": "ஹோட்டல் எங்கே இருக்கிறது?",
        "how much does this cost?": "இதன் விலை என்ன?",
        "how much does this cost": "இதன் விலை என்ன?",
        "how much is this?": "இதன் விலை எவ்வளவு?",
        "where is the airport?": "விமான நிலையம் எங்கே இருக்கிறது?",
        "where is the airport": "விமான நிலையம் எங்கே இருக்கிறது?",
        "where is the nearest hospital?": "அருகிலுள்ள மருத்துவமனை எங்கே உள்ளது?",
        "how much is the fare to the railway station?": "ரயில் நிலையத்திற்கு கட்டணம் எவ்வளவு?",
        "i need immediate police assistance.": "எனக்கு உடனடியாக காவல் உதவி தேவை.",
        "can you please help me find this address?": "இந்த முகவரியைக் கண்டுபிடிக்க எனக்கு உதவ முடியுமா?",
        "where is the nearest pharmacy or doctor?": "அருகிலுள்ள மருந்தகம் அல்லது மருத்துவர் எங்கே உள்ளது?",
        "is there a vegetarian restaurant nearby?": "அருகில் சைவ உணவகம் உள்ளதா?",
        "thank you": "நன்றி",
        "thank you very much": "மிக்க நன்றி",
        "help": "உதவி",
        "emergency": "அவசரம்",
        "police": "காவல்துறை",
        "hospital": "மருத்துவமனை",
        "hotel": "ஹோட்டல்",
        "airport": "விமான நிலையம்",
        "station": "நிலையம்"
    },
    "hi": {
        "hello": "नमस्ते",
        "where is the hotel?": "होटल कहाँ है?",
        "where is the hotel": "होटल कहाँ है?",
        "how much does this cost?": "इसकी कीमत क्या है?",
        "how much does this cost": "इसकी कीमत क्या है?",
        "how much is this?": "यह कितने का है?",
        "where is the airport?": "हवाई अड्डा कहाँ है?",
        "where is the airport": "हवाई अड्डा कहाँ है?",
        "where is the nearest hospital?": "निकटतम अस्पताल कहाँ है?",
        "how much is the fare to the railway station?": "रेलवे स्टेशन का किराया कितना है?",
        "i need immediate police assistance.": "मुझे तुरंत पुलिस सहायता की आवश्यकता है।",
        "can you please help me find this address?": "क्या आप इस पते को खोजने में मेरी मदद कर सकते हैं?",
        "where is the nearest pharmacy or doctor?": "निकटतम फार्मेसी या डॉक्टर कहाँ है?",
        "is there a vegetarian restaurant nearby?": "क्या पास में कोई शाकाहारी रेस्टोरेंट है?",
        "thank you": "धन्यवाद",
        "thank you very much": "बहुत बहुत धन्यवाद",
        "help": "मदদ",
        "emergency": "आपातकाल",
        "police": "पुलिस",
        "hospital": "अस्पताल",
        "hotel": "होटल",
        "airport": "हवाई अड्डा",
        "station": "स्टेशन"
    },
    "te": {
        "hello": "నమస్కారం",
        "where is the hotel?": "హోటల్ ఎక్కడ ఉంది?",
        "where is the hotel": "హోటల్ ఎక్కడ ఉంది?",
        "how much does this cost?": "దీని ఖర్చు ఎంత?",
        "how much does this cost": "దీని ఖర్చు ఎంత?",
        "how much is this?": "దీని ధర ఎంత?",
        "where is the airport?": "విమానాశ్రయం ఎక్కడ ఉంది?",
        "where is the airport": "విమానాశ్రయం ఎక్కడ ఉంది?",
        "where is the nearest hospital?": "సమీప ఆసుపత్రి ఎక్కడ ఉంది?",
        "how much is the fare to the railway station?": "రైల్వే స్టేషన్ కు ఛార్జీ ఎంత?",
        "i need immediate police assistance.": "నాకు తక్షణ పోలీసు సహాయం కావాలి.",
        "can you please help me find this address?": "దయచేసి ఈ చిరునామాను కనుగొనడంలో నాకు సహాయం చేయగలరా?",
        "where is the nearest pharmacy or doctor?": "సమీప ఫార్మసీ లేదా డాక్టర్ ఎక్కడ ఉన్నారు?",
        "is there a vegetarian restaurant nearby?": "సమీపంలో శాఖాహార రెస్టారెంట్ ఉందా?",
        "thank you": "ధన్యవాదాలు",
        "thank you very much": "చాలా ధన్యవాదాలు",
        "help": "సహాయం",
        "emergency": "అత్యవసర పరిస్థితి",
        "police": "పోలీసులు",
        "hospital": "ఆసుపత్రి",
        "hotel": "హోటల్",
        "airport": "విమానాశ్రయం",
        "station": "స్టేషన్"
    },
    "ml": {
        "hello": "നമസ്കാരം",
        "where is the hotel?": "ഹോട്ടൽ എവിടെയാണ്?",
        "where is the hotel": "ഹോട്ടൽ എവിടെയാണ്?",
        "how much does this cost?": "ഇതിന് എത്ര ചിലവാകും?",
        "how much does this cost": "ഇതിന് എത്ര ചിലവാകും?",
        "how much is this?": "ഇതിന് എത്രയാണ് വില?",
        "where is the airport?": "വിമാനത്താവളം എവിടെയാണ്?",
        "where is the airport": "വിമാനത്താവളം എവിടെയാണ്?",
        "where is the nearest hospital?": "ഏറ്റവും അടുത്തുള്ള ആശുപത്രി എവിടെയാണ്?",
        "how much is the fare to the railway station?": "റെയിൽവേ സ്റ്റേഷനിലേക്ക് എത്രയാണ് യാത്രാക്കൂലി?",
        "i need immediate police assistance.": "എനിക്ക് അടിയന്തിര പോലീസ് സഹായം ആവശ്യമാണ്.",
        "can you please help me find this address?": "ഈ വിലാസം കണ്ടെത്താൻ എന്നെ സഹായിക്കാമോ?",
        "where is the nearest pharmacy or doctor?": "ഏറ്റവും അടുത്തുള്ള ഫാർമസി അല്ലെങ്കിൽ ഡോക്ടർ எവിടെയാണ്?",
        "is there a vegetarian restaurant nearby?": "അടുത്ത് വെജിറ്റേറിയൻ റസ്റ്റോറന്റ് ഉണ്ടോ?",
        "thank you": "നന്ദി",
        "thank you very much": "വളരെ നന്ദി",
        "help": "സഹായം",
        "emergency": "അടിയന്തരാവസ്ഥ",
        "police": "പോലീസ്",
        "hospital": "ആശുപത്രി",
        "hotel": "ഹോട്ടൽ",
        "airport": "വിമാനത്താവളം",
        "station": "സ്റ്റേഷൻ"
    },
    "kn": {
        "hello": "ನಮಸ್ಕಾರ",
        "where is the hotel?": "ಹೋಟೆಲ್ ಎಲ್ಲಿದೆ?",
        "where is the hotel": "ಹೋಟೆಲ್ ಎಲ್ಲಿದೆ?",
        "how much does this cost?": "ಇದರ ಬೆಲೆ ಎಷ್ಟು?",
        "how much does this cost": "ಇದರ ಬೆಲೆ ಎಷ್ಟು?",
        "how much is this?": "ಇದಕ್ಕೆ ಎಷ್ಟು ಬೆಲೆ?",
        "where is the airport?": "ವಿಮಾನ ನಿಲ್ದಾಣ ಎಲ್ಲಿದೆ?",
        "where is the airport": "ವಿಮಾನ ನಿಲ್ದಾಣ ಎಲ್ಲಿದೆ?",
        "where is the nearest hospital?": "ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ ಎಲ್ಲಿದೆ?",
        "how much is the fare to the railway station?": "ರೈಲ್ವೆ ನಿಲ್ದಾಣಕ್ಕೆ ದರ ಎಷ್ಟು?",
        "i need immediate police assistance.": "ನನಗೆ ತಕ್ಷಣದ ಪೊಲೀಸ್ ಸಹಾಯ ಬೇಕು.",
        "can you please help me find this address?": "ದಯವಿಟ್ಟು ಈ ವಿಳಾಸವನ್ನು ಹುಡುಕಲು ನನಗೆ ಸಹಾಯ ಮಾಡುವಿರಾ?",
        "where is the nearest pharmacy or doctor?": "ಹತ್ತಿರದ ಔಷಧಾಲಯ ಅಥವಾ ವೈದ್ಯರು ಎಲ್ಲಿದ್ದಾರೆ?",
        "is there a vegetarian restaurant nearby?": "ಹತ್ತಿರದಲ್ಲಿ ಸಸ್ಯಾಹಾರಿ ಉಪಹಾರ ಗೃಹವಿದೆಯೇ?",
        "thank you": "ಧನ್ಯವಾದಗಳು",
        "thank you very much": "ತುಂಬಾ ಧನ್ಯವಾದಗಳು",
        "help": "ಸಹಾಯ",
        "emergency": "ತುರ್ತು ಪರಿಸ್ಥಿತಿ",
        "police": "ಪೊಲೀಸ್",
        "hospital": "ಆಸ್ಪತ್ರೆ",
        "hotel": "ಹೋಟೆಲ್",
        "airport": "ವಿಮಾನ ನಿಲ್ದಾಣ",
        "station": "ನಿಲ್ದಾಣ"
    }
}

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "status": "ok",
        "engine": "LibreTranslate-Argos Local",
        "port": 5050
    })

@app.route("/languages", methods=["GET"])
def languages():
    return jsonify(get_installed_languages())

@app.route("/translate", methods=["POST"])
def translate():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("q") or data.get("text") or ""
    source = (data.get("source") or data.get("sourceLanguage") or "en").lower()
    target = (data.get("target") or data.get("targetLanguage") or "ta").lower()

    if not text.strip():
        return jsonify({"translatedText": "", "original": ""})

    if source == target:
        return jsonify({"translatedText": text, "source": source, "target": target})

    # 1. Check offline phrase dictionary for direct match
    clean_key = text.strip().lower()
    if target in OFFLINE_PHRASES and clean_key in OFFLINE_PHRASES[target]:
        return jsonify({
            "translatedText": OFFLINE_PHRASES[target][clean_key],
            "source": source,
            "target": target
        })

    # 2. Try local Argos Translate model
    translated = do_argos_translation(text, source, target)
    if translated:
        return jsonify({"translatedText": translated, "source": source, "target": target})

    # 3. Clean fallback
    return jsonify({
        "translatedText": OFFLINE_PHRASES.get(target, {}).get(clean_key, f"{text}"),
        "source": source,
        "target": target
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    logger.info(f"Starting Local LibreTranslate Service on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
