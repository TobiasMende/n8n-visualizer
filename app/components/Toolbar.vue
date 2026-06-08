<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
import { allTags } from '~/composables/useTagFilter'
import { searchGraph } from '~/composables/useSearch'

const store = useGraphStore()

const baseUrl = ref('')
const apiKey = ref('')
const uploadBaseUrl = ref('')
const query = ref('')
const showUnresolved = ref(false)

const tags = computed(() => allTags(store.graph))
const results = computed(() => searchGraph(store.graph, query.value).slice(0, 10))

function toggleTag(tag: string) {
  store.tagFilter = store.tagFilter.includes(tag)
    ? store.tagFilter.filter(t => t !== tag)
    : [...store.tagFilter, tag]
}

function pick(id: string) { store.selectedId = id; query.value = '' }

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    store.error = 'Could not parse that file as JSON.'
    input.value = ''
    return
  }
  await store.loadFromUpload(parsed, uploadBaseUrl.value || null)
  input.value = ''
}
</script>

<template>
  <div class="toolbar">
    <details :open="!store.connectedHost">
      <summary>{{ store.connectedHost ? `Connected to ${store.connectedHost}` : 'Connect' }}</summary>
      <template v-if="store.connectedHost">
        <div class="row">
          <button class="disconnect" @click="store.disconnect()">Disconnect</button>
          <span class="hint">API key stored for this browser session only.</span>
        </div>
      </template>
      <template v-else>
        <div class="row">
          <input v-model="baseUrl" placeholder="https://n8n.example.com" />
          <input v-model="apiKey" type="password" placeholder="API key" />
          <button :disabled="store.loading" @click="store.loadFromApi(baseUrl, apiKey)">Load via API</button>
        </div>
        <div class="row">
          <input v-model="uploadBaseUrl" placeholder="instance URL (optional, for links)" />
          <input type="file" accept="application/json" @change="onUpload" />
        </div>
      </template>
      <p v-if="store.error" class="err">{{ store.error }}</p>
    </details>

    <div v-if="store.graph" class="row search">
      <input v-model="query" placeholder="Search workflows / webhooks…" />
      <ul v-if="results.length" class="results">
        <li v-for="r in results" :key="r.workflowId + r.label" @click="pick(r.workflowId)">
          <span class="kind">{{ r.kind }}</span> {{ r.label }}
        </li>
      </ul>
    </div>

    <div v-if="tags.length" class="row tags">
      <button v-for="tag in tags" :key="tag"
              :class="{ active: store.tagFilter.includes(tag) }" @click="toggleTag(tag)">
        {{ tag }}
      </button>
    </div>

    <div v-if="store.graph?.unresolved.length" class="row">
      <button @click="showUnresolved = !showUnresolved">
        Unresolved links ({{ store.graph.unresolved.length }})
      </button>
      <ul v-if="showUnresolved">
        <li v-for="(u, i) in store.graph.unresolved" :key="i">{{ u.workflowId }} · {{ u.nodeName }} — {{ u.reason }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.toolbar { padding: 10px; border-bottom: 1px solid #ddd; display: flex; flex-direction: column; gap: 8px; background: #fafafa; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; position: relative; }
.tags button.active { background: #3b82f6; color: #fff; }
.search .results { position: absolute; top: 100%; left: 0; background: #fff; border: 1px solid #ddd; list-style: none; margin: 0; padding: 4px; width: 320px; z-index: 5; }
.search .results li { padding: 4px 6px; cursor: pointer; }
.search .results li:hover { background: #eef; }
.kind { font-size: 11px; color: #888; margin-right: 6px; }
.err { color: #c00; }
.disconnect { background: var(--bg-3); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-s); padding: 4px 10px; cursor: pointer; }
.hint { color: var(--text-faint); font-size: 11px; }
</style>
