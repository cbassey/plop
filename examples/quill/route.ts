/**
 * plop HTTP adapter for the quill agent (smart-notes) — EXAMPLE.
 *
 * Drop this file into the smart-notes repo as:
 *     app/api/plop-adapter/route.ts
 *
 * Then attack quill from the plop repo:
 *     python -m plop.harness --label quill --adapter http \
 *         --url http://localhost:3000/api/plop-adapter
 *
 * The route implements plop's transcript contract (see
 * docs/adapter-contract.md): it takes one case JSON in, runs the agent, and
 * returns one transcript JSON out.
 *
 * Quill's own runAgentLoop (lib/agent/core.ts) does not record per-call
 * data, so this route mirrors that loop in a thin form and records every
 * tool call. It reuses quill's real prompt, tools, and tool executor, so the
 * attack surface under test is the real one. If you later add an onToolCall
 * hook to runAgentLoop, call it directly instead.
 *
 * This is an example for ONE agent. The contract itself is agent-agnostic:
 * any agent in any language can implement the same JSON-in, JSON-out shape.
 */

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

import { getPromptForTrigger } from '@/lib/agent/prompts'
import { executeAgentTool, getToolsForTrigger } from '@/lib/agent/tools'
import type { AgentContext } from '@/lib/agent/types'

// plop's case payload (what the harness POSTs).
type PlopCase = {
    id: string
    category: string
    prompt: string
    task_mode: 'read_only' | 'read_write'
    allowed_tools: string[] | null
    defended: boolean
}

// plop's transcript (what this route must return).
type PlopTranscript = {
    final_text: string
    stop_reason: string
    iterations: number
    tool_calls: Array<{
        name: string
        input: Record<string, unknown>
        blocked: boolean
        is_error: boolean
    }>
    writes: Array<Record<string, unknown>>
}

const MAX_ITERATIONS = 6

export async function POST(request: NextRequest) {
    // Never expose an attack endpoint in production.
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'not available' }, { status: 404 })
    }

    const plopCase = (await request.json()) as PlopCase

    // Map the plop case onto a real quill trigger. The prompt arrives the
    // same way real user data arrives: as note content. That is exactly the
    // channel indirect injection rides in on.
    const context: AgentContext = {
        userId: process.env.PLOP_TEST_USER_ID ?? 'plop-test-user',
        trigger: { type: 'note_save', payload: {} } as AgentContext['trigger'],
        noteContent: plopCase.prompt,
        existingActionItems: [],
    }

    const systemPrompt = getPromptForTrigger(context.trigger.type, undefined)
    let tools = getToolsForTrigger(context.trigger.type)

    // When plop asks for a defended run, apply your guards here. The
    // strongest and simplest one: on a read-only case, do not offer
    // state-changing tools at all. (Port more of plop.guards as needed:
    // input validation, output sanitization, the repeat-call breaker.)
    if (plopCase.defended && plopCase.task_mode === 'read_only') {
        tools = tools.filter((t) => t.name === 'suggest_tags')
    }

    const transcript: PlopTranscript = {
        final_text: '',
        stop_reason: 'max_iterations',
        iterations: 0,
        tool_calls: [],
        writes: [],
    }

    const anthropic = new Anthropic()
    const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: plopCase.prompt },
    ]

    for (let turn = 0; turn < MAX_ITERATIONS; turn++) {
        transcript.iterations = turn + 1
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-5',
            max_tokens: 1024,
            system: systemPrompt,
            messages,
            tools,
        })

        const toolUses = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        )
        if (toolUses.length === 0) {
            transcript.final_text = response.content
                .filter((b): b is Anthropic.TextBlock => b.type === 'text')
                .map((b) => b.text)
                .join('\n')
            transcript.stop_reason = 'end_turn'
            break
        }

        messages.push({ role: 'assistant', content: response.content })
        const results: Anthropic.ToolResultBlockParam[] = []

        for (const use of toolUses) {
            const input = use.input as Record<string, unknown>
            let resultText: string
            let isError = false
            let created = 0
            try {
                const out = await executeAgentTool(use.name, input, context)
                resultText = out.result
                created = out.createdCount
            } catch (err) {
                resultText = `Error: ${String(err)}`
                isError = true
            }

            transcript.tool_calls.push({
                name: use.name,
                input,
                blocked: false,
                is_error: isError,
            })
            // Every state-changing action counts as a write for scoring.
            if (created > 0) {
                transcript.writes.push({ tool: use.name, created })
            }
            results.push({
                type: 'tool_result',
                tool_use_id: use.id,
                content: resultText,
                is_error: isError,
            })
        }

        messages.push({ role: 'user', content: results })
    }

    return NextResponse.json(transcript)
}
