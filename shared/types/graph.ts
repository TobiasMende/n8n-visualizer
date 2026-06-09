export type TriggerType = 'webhook' | 'schedule' | 'manual' | 'app' | 'unknown'
export type LinkType = 'execute' | 'webhookHttp' | 'error' | 'trigger'
export type TriggerKind = 'webhook' | 'schedule' | 'manual' | 'app' | 'form'

export interface RawNode {
  id?: string
  name: string
  type: string
  webhookId?: string
  parameters?: Record<string, any>
  credentials?: Record<string, { id?: string; name?: string }>
}

export interface RawWorkflow {
  id: string
  name: string
  active?: boolean
  nodes: RawNode[]
  connections?: Record<string, any>
  settings?: { errorWorkflow?: string; [k: string]: any }
  tags?: ({ id?: string; name: string } | string)[]
}

export interface NodeTypeCount { type: string; displayName: string; count: number }

export type CadenceGroup =
  | 'sub-minute' | 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron'

export interface WebhookEntry {
  workflowId: string
  method: string
  path: string
  auth: string
  secured: boolean
  prodUrl: string | null
  testUrl: string | null
}

export interface ScheduleEntry {
  workflowId: string
  cadenceText: string
  cadenceGroup: CadenceGroup
  nextFire: string | null
}

export type EntitySource = 'api' | 'inferred' | 'both'

export interface CredentialRef {
  id: string | null
  name: string
  type: string
  workflowIds: string[]
  source: EntitySource
  createdAt?: string
  updatedAt?: string
}

export interface DataTableColumn { name: string; type: string }

export interface DataTableRef {
  id: string
  name: string
  projectId: string | null
  workflowIds: string[]
  operations: string[]
  source: EntitySource
  deepLink?: string | null
  columns?: DataTableColumn[]
  createdAt?: string
  updatedAt?: string
}

export interface EnrichmentStatus { credentials: boolean; dataTables: boolean }

export interface WorkflowSummary {
  nodeCount: number
  nodeTypes: NodeTypeCount[]
  credentials: string[]
  inbound: number
  outbound: number
}

export interface WorkflowNode {
  id: string
  name: string
  active: boolean
  triggers: TriggerType[]
  tags: string[]
  webhookPaths: string[]
  summary: WorkflowSummary
  deepLink: string | null
}

export interface WorkflowEdge { source: string; target: string; type: LinkType }

export interface TriggerNode {
  id: string
  workflowId: string
  kind: TriggerKind
  label: string
  secured?: boolean
}

export interface UnresolvedLink { workflowId: string; nodeName: string; reason: string }
export interface SkippedWorkflow { name?: string; reason: string }

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  triggerNodes: TriggerNode[]
  unresolved: UnresolvedLink[]
  skipped: SkippedWorkflow[]
  webhooks: WebhookEntry[]
  schedules: ScheduleEntry[]
  credentials: CredentialRef[]
  dataTables: DataTableRef[]
  enrichment: EnrichmentStatus
}
