import { AIService } from './services/aiService.js';
import { TranslationService } from './services/translationService.js';
import { View } from './views/view.js';
import { FormController } from './controllers/formController.js';

async function prepareModels(aiService, translationService, view) {
    const [modelAvailability, translationAvailability] = await Promise.all([
        aiService.getModelAvailability(),
        translationService.getAvailability(),
    ]);

        if (modelAvailability === 'unavailable') {
        throw new Error('⚠️ O Gemini Nano não está disponível neste navegador. Use o Google Chrome com as flags #prompt-api e #prompt-api-multimodal-input ativas, e confira o status do modelo em chrome://on-device-internals.');
    }
    if (translationAvailability === 'unavailable') {
        throw new Error('⚠️ Tradução de inglês para português não está disponível.');
    }

    if (modelAvailability === 'available' && translationAvailability === 'available') {
        await translationService.initialize();
        return;
    }

    // Chrome only allows model downloads to start from a user gesture
    view.showDownloadPanel();
    await new Promise((resolve) => view.onDownloadClick(resolve));
    view.setDownloadInProgress();

    const downloads = [translationService.initialize()];
    if (modelAvailability !== 'available') {
        downloads.push(aiService.downloadModel((fraction) => view.updateDownloadProgress(fraction)));
    }
    await Promise.all(downloads);

    view.hideDownloadPanel();
}

(async function main() {
    // Initialize services and view
    const aiService = new AIService();
    const translationService = new TranslationService();
    const view = new View();

    // Set current year
    view.setYear();

    // Check requirements
    const errors = await aiService.checkRequirements();
    if (errors) {
        view.showError(errors);
        return;
    }

    // Download (if needed) and initialize models
    try {
        await prepareModels(aiService, translationService, view);
    } catch (error) {
        console.error('Error preparing models:', error);
        view.hideDownloadPanel();
        view.showError([error.message]);
        return;
    }

    // Get and initialize AI parameters
    const params = await aiService.getParams();
    view.initializeParameters(params);

    // Initialize controller and setup event listeners
    const controller = new FormController(aiService, translationService, view);
    controller.setupEventListeners();

    console.log('Application initialized successfully');
})();