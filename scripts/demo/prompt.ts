import * as readline from 'node:readline'

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    if (hidden) {
      const out = process.stdout
      // @ts-expect-error _writeToOutput is internal but stable
      rl._writeToOutput = (s: string) => { if (s.includes('\n')) out.write('\n') }
    }
    rl.question(question, answer => { rl.close(); resolve(answer.trim()) })
  })
}

export interface Creds { baseUrl: string; apiKey: string; allowLocal: boolean }

export async function promptCreds(argv: string[]): Promise<Creds> {
  const allowLocal = argv.includes('--allow-local')
  const baseUrl = await ask('n8n instance URL (e.g. https://n8n.example.com): ')
  if (!/^https?:\/\//.test(baseUrl)) throw new Error('URL must start with http(s)://')
  const apiKey = await ask('n8n API key (hidden): ', true)
  if (!apiKey) throw new Error('API key is required')
  return { baseUrl, apiKey, allowLocal }
}
