export type TriggerType = 'webhook' | 'schedule' | 'manual' | 'app' | 'unknown'
export type LinkType = 'execute' | 'webhookHttp' | 'error'

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
  prodUrl: string | null
  testUrl: string | null
}

export interface ScheduleEntry {
  workflowId: string
  cadenceText: string
  cadenceGroup: CadenceGroup
  nextFire: string | null
}

export interface CredentialRef {
  id: string | null
  name: string
  type: string
  workflowIds: string[]
}

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
export interface UnresolvedLink { workflowId: string; nodeName: string; reason: string }
export interface SkippedWorkflow { name?: string; reason: string }

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  unresolved: UnresolvedLink[]
  skipped: SkippedWorkflow[]
  webhooks: WebhookEntry[]
  schedules: ScheduleEntry[]
  credentials: CredentialRef[]
}
