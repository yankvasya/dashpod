import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/i18n/locales/en';
import ru from '@/i18n/locales/ru';

// No device-locale auto-detection — default is English, and the user picks a language
// explicitly in Settings (see useSettings.tsx, which calls i18next.changeLanguage on load/change).
i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
