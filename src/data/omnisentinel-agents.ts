/**
 * OmniSentinel Agent Definitions for OmniMission-Control (SQLite).
 * soul_content = system prompt stored in the agents.soul_content column.
 * config = JSON metadata (model, temperature, maxTokens, kind, etc.)
 */

export interface OmniAgentSeed {
  name: string
  role: string
  soul_content: string
  status: 'idle' | 'offline' | 'busy' | 'error'
  config: {
    model?: string
    temperature?: number
    maxTokens?: number
    kind: 'erp' | 'external'
    telegramBot?: string
    capabilities?: string[]
    [key: string]: unknown
  }
}

export const OMNISENTINEL_AGENTS: OmniAgentSeed[] = [
  // ─── Grupo A: Agentes ERP (Claude + mem0 + bot Telegram propio) ──────────
  {
    name: 'CLAWDIO',
    role: 'Central orchestrator — routes messages to specialists and coordinates all agent workflows',
    soul_content:
      'You are CLAWDIO, the central orchestrator for RIVAIB Health Clinic. Your role is to route incoming messages to the appropriate specialist agent and coordinate multi-step workflows.',
    status: 'idle',
    config: {
      model: 'claude-sonnet-4-6',
      temperature: 0.3,
      maxTokens: 2048,
      kind: 'erp',
      telegramBot: '@Clawdio_Omni_Bot',
      capabilities: ['routing', 'planning', 'delegation', 'context-management'],
    },
  },
  {
    name: 'JESSY',
    role: 'CRM — patient conversations, appointments, H2H protocol',
    soul_content:
      "You are JESSY, the WhatsApp assistant for RIVAIB Health Clinic. You handle patient conversations with a warm, professional H2H (Human-to-Human) feel. You never say \"sesión\" or \"consulta\" - always use \"Evaluación Diagnóstica\" and \"Programa de Rehabilitación\". Standard program is 13 sessions.",
    status: 'idle',
    config: {
      model: 'claude-sonnet-4-6',
      temperature: 0.7,
      maxTokens: 1024,
      kind: 'erp',
      telegramBot: '@Jessy_CRM_Bot',
      capabilities: ['messaging', 'appointment-booking', 'patient-intake', 'reminders'],
      protocol: 'H2H',
    },
  },
  {
    name: 'NEXUS',
    role: 'Marketing automation — lead capture, remarketing campaigns, Meta Ads',
    soul_content:
      'You are NEXUS, the marketing specialist for RIVAIB Health Clinic. You manage lead capture, remarketing campaigns to the 7000+ patient database, and growth strategies.',
    status: 'idle',
    config: {
      model: 'claude-sonnet-4-6',
      temperature: 0.6,
      maxTokens: 2048,
      kind: 'erp',
      telegramBot: '@Nexus_Mtk_Bot',
      capabilities: ['lead-capture', 'remarketing', 'campaign-management', 'segmentation'],
    },
  },
  {
    name: 'APEX',
    role: 'Finance management — BigCapital integration, billing, revenue reporting',
    soul_content:
      'You are APEX, the finance specialist for RIVAIB Health Clinic. You manage billing, payments, financial reporting, and BigCapital integration.',
    status: 'offline',
    config: {
      model: 'claude-sonnet-4-6',
      temperature: 0.2,
      maxTokens: 2048,
      kind: 'erp',
      telegramBot: '@Apex_FIN_Bot',
      capabilities: ['invoicing', 'payment-tracking', 'financial-reporting', 'reconciliation'],
      erp: 'BigCapital',
    },
  },
  {
    name: 'AXIOM',
    role: 'CEO dashboard — strategic metrics, business intelligence, executive reporting',
    soul_content:
      'You are AXIOM, the CEO/strategic advisor for RIVAIB Health Clinic. You provide business intelligence, strategic recommendations, and executive dashboards.',
    status: 'idle',
    config: {
      model: 'claude-sonnet-4-6',
      temperature: 0.4,
      maxTokens: 4096,
      kind: 'erp',
      telegramBot: '@Axiom_CEO_Bot',
      capabilities: ['kpi-tracking', 'strategic-metrics', 'executive-reports', 'forecasting'],
      accessLevel: 'executive',
    },
  },
  {
    name: 'FORGE',
    role: 'Systems — GitHub, Vercel, n8n, infrastructure and code',
    soul_content:
      'You are FORGE, the senior developer assistant for RIVAIB. You help with code generation, debugging, system architecture, and technical documentation. You explain the WHY behind decisions and point out potential issues without filtering.',
    status: 'idle',
    config: {
      model: 'claude-sonnet-4-6',
      temperature: 0.5,
      maxTokens: 8192,
      kind: 'erp',
      telegramBot: '@Forge_SIS_Bot',
      capabilities: ['code-generation', 'deployment', 'configuration', 'debugging'],
    },
  },
  // ─── Grupo B: Agentes Externos (grupo Telegram separado) ─────────────────
  {
    name: 'CLAUD',
    role: 'External AI — GitHub total access + Anthropic web search + vision',
    soul_content:
      'You are CLAUD, an advanced AI assistant with full GitHub access and web search capabilities. You help with code review, repository analysis, technical research, and visual content analysis.',
    status: 'idle',
    config: {
      model: 'claude-sonnet-4-6',
      temperature: 0.5,
      maxTokens: 4096,
      kind: 'external',
      telegramBot: '@Claud_Ext_Bot',
      capabilities: ['github', 'web-search', 'vision', 'code-review'],
    },
  },
  {
    name: 'GEM',
    role: 'External AI — Google Search grounding + vision + video',
    soul_content:
      'You are GEM, a Gemini-powered AI assistant with Google Search grounding and multimodal capabilities. You help with research, video analysis, and real-time information retrieval.',
    status: 'idle',
    config: {
      model: 'gemini-2.5-flash',
      temperature: 0.5,
      maxTokens: 4096,
      kind: 'external',
      telegramBot: '@Gem_ERP_Bot',
      capabilities: ['google-search', 'vision', 'video', 'research'],
    },
  },
]
