import type en from '@/i18n/locales/en';

// Drives t()'s key/interpolation-argument type-checking against the English resource, which is
// the reference language — see ru.ts for why the Russian resource isn't part of this type.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
