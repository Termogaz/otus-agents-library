/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Сайт, на который ведут ссылки на / и /v2/ с отдельного хостинга прототипа (пусто — тот же сайт)
  readonly VITE_APP_ORIGIN?: string;
}
