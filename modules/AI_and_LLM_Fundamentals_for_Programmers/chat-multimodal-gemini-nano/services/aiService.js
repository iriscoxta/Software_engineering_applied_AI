const TEXT_INPUT = { type: "text", languages: ["en"] };
const TEXT_OUTPUT = { type: "text", languages: ["en"] };
const IMAGE_INPUT = { type: "image" };

export class AIService {
    constructor() {
        this.session = null;
        this.abortController = null;
        this.imageSupported = false;
    }

    async checkRequirements() {
        const errors = [];

        // @ts-ignore
        const isChrome = !!window.chrome;
        if (!isChrome) {
            errors.push("⚠️ Este recurso só funciona no Google Chrome ou Chrome Canary (versão recente).");
        }

        if (!window.isSecureContext) {
            errors.push("⚠️ As APIs de IA só funcionam em contexto seguro.");
            errors.push(`Abra a aplicação por http://localhost:${location.port} em vez de ${location.host}.`);
            return errors;
        }

        if (!('LanguageModel' in self)) {
            errors.push("⚠️ As APIs nativas de IA não estão ativas.");
            errors.push("Ative as seguintes flags em chrome://flags/:");
            errors.push("- Prompt API (chrome://flags/#prompt-api)");
            errors.push("- Prompt API Multimodal Input (chrome://flags/#prompt-api-multimodal-input)");
            errors.push("Depois reinicie o Chrome e tente novamente.");
            return errors;
        }

        if (!('Translator' in self)) {
            errors.push("⚠️ A API de Tradução (Translator) não está disponível neste navegador.");
        }

        if (!('LanguageDetector' in self)) {
            errors.push("⚠️ A API de Detecção de Idioma (LanguageDetector) não está disponível neste navegador.");
        }

        return errors.length > 0 ? errors : null;
    }

    async getModelAvailability() {
        const [textAvailability, imageAvailability] = await Promise.all([
            LanguageModel.availability({ expectedInputs: [TEXT_INPUT], expectedOutputs: [TEXT_OUTPUT] }),
            LanguageModel.availability({ expectedInputs: [TEXT_INPUT, IMAGE_INPUT], expectedOutputs: [TEXT_OUTPUT] }),
        ]);
        console.log('Language Model availability:', { text: textAvailability, image: imageAvailability });

        // When the device supports images, the model only counts as ready once the image part is downloaded too
        this.imageSupported = imageAvailability !== 'unavailable';
        return this.imageSupported ? imageAvailability : textAvailability;
    }

    async downloadModel(onProgress) {
        const session = await LanguageModel.create({
            expectedInputs: this.imageSupported ? [TEXT_INPUT, IMAGE_INPUT] : [TEXT_INPUT],
            expectedOutputs: [TEXT_OUTPUT],
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => onProgress(e.loaded));
            },
        });
        session.destroy();
    }

    async getParams() {
        // LanguageModel.params() is no longer exposed to web pages in recent Chrome versions
        if (typeof LanguageModel.params !== 'function') {
            const fallbackParams = {
                defaultTopK: 3,
                maxTopK: 8,
                defaultTemperature: 1,
                maxTemperature: 2,
            };
            console.warn('LanguageModel.params() indisponível, usando valores padrão:', fallbackParams);
            return fallbackParams;
        }

        const params = await LanguageModel.params();
        console.log('Language Model Params:', params);
        return params;
    }

    async* createSession(question, temperature, topK, file = null) {
        this.abortController?.abort();
        this.abortController = new AbortController();

        // Destroy previous session and create new one with updated parameters
        if (this.session) {
            this.session.destroy();
        }

        // Declare only the input types this prompt actually uses
        const expectedInputs = [TEXT_INPUT];
        const contentArray = [{ type: "text", value: question }];

        if (file) {
            const fileType = file.type.split('/')[0];
            if (fileType === 'image' || fileType === 'audio') {
                expectedInputs.push({ type: fileType });
                // Convert file to blob for proper handling
                const blob = new Blob([await file.arrayBuffer()], { type: file.type });
                contentArray.push({ type: fileType, value: blob });
                console.log(`Adding ${fileType} to prompt:`, file.name);
            }
        }

        this.session = await LanguageModel.create({
            expectedInputs,
            expectedOutputs: [TEXT_OUTPUT],
            temperature: temperature,
            topK: topK,
            initialPrompts: [
                {
                    role: 'system',
                    content: [{
                        type: "text",
                        value: `You are an AI assistant that responds clearly and objectively.
                        Always respond in plain text format instead of markdown.`
                    }]
                },
            ],
        });

        const responseStream = await this.session.promptStreaming(
            [
                {
                    role: 'user',
                    content: contentArray,
                },
            ],
            {
                signal: this.abortController.signal,
            }
        );

        for await (const chunk of responseStream) {
            if (this.abortController.signal.aborted) {
                break;
            }
            yield chunk;
        }
    }

    abort() {
        this.abortController?.abort();
    }

    isAborted() {
        return this.abortController?.signal.aborted;
    }
}