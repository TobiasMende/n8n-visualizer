export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@pinia/nuxt'],
  css: ['@vue-flow/core/dist/style.css', '@vue-flow/core/dist/theme-default.css'],
  typescript: { strict: true },
  devtools: { enabled: true },
})
