export class TranslationService {
    constructor() {
        this.translator = null;
        this.languageDetector = null;
    }

    async getAvailability() {
        const [translatorAvailability, detectorAvailability] = await Promise.all([
            Translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' }),
            LanguageDetector.availability(),
        ]);
        console.log('Translation availability:', { translator: translatorAvailability, detector: detectorAvailability });

        if (translatorAvailability === 'unavailable' || detectorAvailability === 'unavailable') {
            return 'unavailable';
        }
        if (translatorAvailability === 'available' && detectorAvailability === 'available') {
            return 'available';
        }
        return 'downloadable';
    }

    async initialize() {
        try {
            // Both are created at once so a download, when needed, starts inside the user's click
            const [translator, languageDetector] = await Promise.all([
                Translator.create({
                    sourceLanguage: 'en',
                    targetLanguage: 'pt',
                    monitor(m) {
                        m.addEventListener('downloadprogress', (e) => {
                            console.log(`Translator downloaded ${Math.round(e.loaded * 100)}%`);
                        });
                    }
                }),
                LanguageDetector.create(),
            ]);

            this.translator = translator;
            this.languageDetector = languageDetector;
            console.log('Translator and Language Detector initialized');

            return true;
        } catch (error) {
            console.error('Error initializing translation:', error);
            throw new Error('⚠️ Erro ao inicializar APIs de tradução.');
        }
    }

    async translateToPortuguese(text) {
        if (!this.translator) {
            console.warn('Translator not available, returning original text');
            return text;
        }

        try {
            // Detect language first
            if (this.languageDetector) {
                const detectionResults = await this.languageDetector.detect(text);
                console.log('Detected languages:', detectionResults);

                // If already in Portuguese, no need to translate
                if (detectionResults && detectionResults[0]?.detectedLanguage === 'pt') {
                    console.log('Text is already in Portuguese');
                    return text;
                }
            }

            const translated = await this.translator.translate(text);
            console.log('Translated text:', translated);
            return translated;
        } catch (error) {
            console.error('Translation error:', error);
            return text; // Return original text if translation fails
        }
    }
}