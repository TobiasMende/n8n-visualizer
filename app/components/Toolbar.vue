<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
import { allTags } from '~/composables/useTagFilter'
import { searchGraph } from '~/composables/useSearch'

const store = useGraphStore()

const baseUrl = ref('')
const apiKey = ref('')
const uploadBaseUrl = ref('')
const showUnresolved = ref(false)

const tags = computed(() => allTags(store.graph))
const results = computed(() => searchGraph(store.graph, store.searchQuery).slice(0, 10))

function toggleTag(tag: string) {
  store.tagFilter = store.tagFilter.includes(tag)
    ? store.tagFilter.filter(t => t !== tag)
    : [...store.tagFilter, tag]
}

function pick(id: string) { store.selectedId = id; store.selectedCredId = null; store.view = 'map'; store.searchQuery = '' }

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
      <input v-model="store.searchQuery" placeholder="Search workflows / webhooks…" />
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

    <div v-if="store.graph?.unresolved.length" class="row unresolved">
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
.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
details { position: relative; }
summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
  background: var(--bg-2); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-m); padding: 7px 11px; font-size: 12px; }
summary::-webkit-details-marker { display: none; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; position: relative; margin-top: 8px; }
input { background: var(--bg-2); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-m); padding: 7px 10px; font-size: 12px; }
input::placeholder { color: var(--text-faint); }
button { background: var(--accent-dim); color: var(--accent); border: 1px solid transparent; border-radius: var(--radius-m); padding: 7px 12px; font-size: 12px; cursor: pointer; }
button:hover { filter: brightness(1.15); }
.disconnect { background: var(--bg-3); color: var(--text); border: 1px solid var(--border); }
.hint { color: var(--text-faint); font-size: 11px; }
.search { position: relative; }
.search input { width: 280px; }
.search .results { position: absolute; top: 100%; left: 0; margin-top: 4px; background: var(--bg-2); border: 1px solid var(--border);
  border-radius: var(--radius-m); list-style: none; padding: 4px; width: 320px; z-index: 40; box-shadow: var(--shadow-1); }
.search .results li { padding: 5px 8px; cursor: pointer; border-radius: var(--radius-s); color: var(--text); }
.search .results li:hover { background: var(--bg-3); }
.kind { font-size: 11px; color: var(--text-faint); margin-right: 6px; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tags button { background: var(--bg-3); color: var(--text-dim); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
.tags button.active { background: var(--accent-dim); color: var(--accent); border-color: transparent; }
.err { color: var(--danger); font-size: 12px; }
.unresolved button { background: var(--bg-3); color: var(--text-dim); border: 1px solid var(--border); }
</style>
