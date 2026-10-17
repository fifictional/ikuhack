/**
 * Languages a tenant can pick before a live call. Picking one sets the agent's language (speech recognition + voice
 * model) for the whole call from the first word, instead of hoping the agent notices and switches mid-call.
 * English is the default. "auto" (shown last as "Detect language") keeps the English start and lets the agent switch
 * if it hears another language, but its speech recognition stays English, so a named language is more reliable.
 */
export const CALL_LANGUAGES = [
  { code: "en", label: "English", greeting: "Hi, this is Docket. Tell me what's wrong at home." },
  { code: "ru", label: "Русский", greeting: "Здравствуйте, это Docket. Расскажите, что случилось у вас дома." },
  { code: "pl", label: "Polski", greeting: "Dzień dobry, tu Docket. Powiedz mi, co się dzieje w Twoim domu." },
  { code: "ro", label: "Română", greeting: "Bună ziua, aici Docket. Spuneți-mi ce problemă aveți acasă." },
  { code: "es", label: "Español", greeting: "Hola, soy Docket. Cuéntame qué problema hay en tu casa." },
  { code: "pt", label: "Português", greeting: "Olá, aqui é o Docket. Conte-me o que se passa em casa." },
  { code: "tr", label: "Türkçe", greeting: "Merhaba, ben Docket. Evinizdeki sorunu anlatın." },
  { code: "uk", label: "Українська", greeting: "Вітаю, це Docket. Розкажіть, що трапилося вдома." },
  { code: "ar", label: "العربية", greeting: "مرحباً، أنا Docket. أخبرني ما المشكلة في منزلك." },
  { code: "hi", label: "हिन्दी", greeting: "नमस्ते, मैं Docket हूँ। बताइए, घर में क्या समस्या है।" },
  { code: "auto", label: "Detect language", greeting: undefined },
] as const;

export type CallLanguageCode = (typeof CALL_LANGUAGES)[number]["code"];
