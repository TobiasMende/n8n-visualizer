// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // The ingest/parse layer deliberately uses `any` at untrusted-JSON
    // boundaries (raw n8n payloads, uploads) before narrowing. Keep it visible
    // as a warning rather than failing the build.
    '@typescript-eslint/no-explicit-any': 'warn',
    // Single-word component names (Toolbar) are fine for this app's UI.
    'vue/multi-word-component-names': 'off',
    // Formatting rules that conflict with this codebase's existing template
    // style (single-line attributes, self-closing void elements). Off rather
    // than reformatting every component.
    'vue/first-attribute-linebreak': 'off',
    'vue/html-self-closing': 'off',
    'vue/attributes-order': 'off',
    'vue/v-on-event-hyphenation': 'off',
  },
})
