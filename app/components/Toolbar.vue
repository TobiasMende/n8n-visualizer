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
const scopeHint = computed(() => !!store.connection && !!store.graph &&
  (!store.graph.enrichment.credentials || !store.graph.enrichment.dataTables))
const scopeHintTitle = computed(() =>
  'Add credential:list / dataTable:list scopes to this API key to see unused items and extra metadata.')
const results = computed(() => searchGraph(store.graph, store.searchQuery).slice(0, 10))
const searchFocused = ref(false)

function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    store.searchQuery = ''
    searchFocused.value = false;
    (e.target as HTMLElement).blur()
  } else if (e.key === 'Enter' && results.value.length) {
    pick(results.value[0]!.workflowId)
  }
}

function toggleTag(tag: string) {
  store.tagFilter = store.tagFilter.includes(tag)
    ? store.tagFilter.filter(t => t !== tag)
    : [...store.tagFilter, tag]
}

function pick(id: string) { store.goToMapNode({ focusId: id, workflowId: id }); store.searchQuery = '' }

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
          <span v-if="scopeHint" class="scope-hint" :title="scopeHintTitle">⚠ limited API scope</span>
        </div>
      </template>
      <template v-else>
        <div class="row">
          <input v-model="baseUrl" placeholder="https://n8n.example.com" />
          <span class="apikey">
            <input v-model="apiKey" type="password" placeholder="API key" />
            <span class="help" tabindex="0" aria-label="API key permissions">?
              <span class="tip">This app only reads. Required scopes:
                <strong>Workflow: List</strong> and <strong>Workflow: Read</strong>.
                Optional read-only scopes <strong>Credential: List</strong> and
                <strong>Data Table: List</strong> enrich the credential and data-table
                views with unused items and extra metadata. No write access is ever needed.</span>
            </span>
          </span>
          <button :disabled="store.loading" @click="store.loadFromApi(baseUrl, apiKey)">Load via API</button>
        </div>
        <div class="row">
          <input v-model="uploadBaseUrl" placeholder="instance URL (optional, for links)" />
          <label class="file">
            <input type="file" accept="application/json" @change="onUpload" />
            <span class="i">↥</span> Upload workflows JSON
          </label>
        </div>
      </template>
      <p v-if="store.error" class="err">{{ store.error }}</p>
    </details>

    <div v-if="store.graph" class="row search">
      <input v-model="store.searchQuery" placeholder="Search workflows / webhooks…"
             @focus="searchFocused = true" @blur="searchFocused = false" @keydown="onSearchKey" />
      <ul v-if="results.length && searchFocused" class="results">
        <li v-for="r in results" :key="r.workflowId + r.label" @mousedown.prevent="pick(r.workflowId)">
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
.apikey { position: relative; display: inline-flex; align-items: center; gap: 6px; }
.help { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;
  border-radius: 50%; background: var(--bg-3); color: var(--text-dim); border: 1px solid var(--border);
  font-size: 11px; cursor: help; position: relative; }
.help:hover, .help:focus { color: var(--text); outline: none; }
.help .tip { display: none; position: absolute; top: 100%; left: 0; margin-top: 6px; width: 240px;
  background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-m);
  padding: 8px 10px; font-size: 11px; line-height: 1.5; color: var(--text-dim);
  box-shadow: var(--shadow-1); z-index: 50; cursor: default; }
.help:hover .tip, .help:focus .tip { display: block; }
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
.scope-hint { font-size: 11px; color: var(--warn); cursor: help; }
.file { display: inline-flex; align-items: center; gap: 6px; background: var(--bg-3); color: var(--text);
  border: 1px solid var(--border); border-radius: var(--radius-m); padding: 7px 12px; font-size: 12px; cursor: pointer;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease); }
.file:hover { background: var(--bg-2); border-color: var(--accent); }
.file:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
.file input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.file .i { color: var(--text-dim); }
</style>
