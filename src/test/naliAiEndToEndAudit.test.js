// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}
async function readJson(path) {
  return JSON.parse(await readText(path));
}

describe('Nali AI end-to-end audit invariants', () => {
  it('routes all user assistant messages through the guarded backend function', async () => {
    const assistant = await readText('src/components/AiAssistant.jsx');
    expect(assistant).toContain('base44.functions.invoke("sendAgentMessage"');
    expect(assistant).not.toContain('base44.agents.addMessage(');
    expect(assistant).toContain('request_key: requestKey');
  });

  it('enforces paid AI entitlement on the server, not only in the UI', async () => {
    const sender = await readText('base44/functions/sendAgentMessage/entry.ts');
    expect(sender).toContain("requireEntitlement");
    expect(sender).toContain("'ai.standard'");
    expect(sender).toContain("code: 'AI_NOT_ENTITLED'");
  });

  it('keeps standard and Plus Nali on the same non-destructive validated tool surface', async () => {
    const standard = await readJson('base44/agents/studio_ai.jsonc');
    const plus = await readJson('base44/agents/studio_ai_plus.jsonc');
    const normalize = (agent) => (agent.tool_configs || []).map((tool) => ({
      entity_name: tool.entity_name,
      function_name: tool.function_name,
      allowed_operations: tool.allowed_operations,
    }));
    expect(normalize(plus)).toEqual(normalize(standard));
    expect(plus.model).toBe('claude_opus_4_8');

    for (const agent of [standard, plus]) {
      for (const tool of agent.tool_configs || []) {
        if (tool.entity_name) {
          expect(tool.allowed_operations || []).not.toContain('delete');
          expect(tool.allowed_operations || []).not.toContain('create');
          expect(tool.allowed_operations || []).not.toContain('update');
        }
      }
      const functions = (agent.tool_configs || []).map((tool) => tool.function_name).filter(Boolean);
      expect(functions).toContain('generate-cover-art');
      expect(functions).toContain('suggestTrackTags');
    }
  });

  it('does not pretend a live web-search capability exists and gives grounded freshness guidance', async () => {
    for (const path of ['base44/agents/studio_ai.jsonc', 'base44/agents/studio_ai_plus.jsonc']) {
      const agent = await readJson(path);
      expect(agent.instructions).not.toContain('web_search');
      expect(agent.instructions).toContain('only claim freshness when a configured current-data tool provides it');
      expect(agent.instructions).toContain('Never claim an app action succeeded unless the tool/function actually returned success');
    }
  });

  it('restores the current Nali conversation per account and tier and refreshes missed realtime replies', async () => {
    const assistant = await readText('src/components/AiAssistant.jsx');
    expect(assistant).toContain('nali_ai_conversation:${user.id}:${agentName}');
    expect(assistant).toContain('base44.agents.getConversation(savedId)');
    expect(assistant).toContain('sessionStorage.setItem(conversationStorageKey, conv.id)');
    expect(assistant).toContain('const fresh = await base44.agents.getConversation(conv.id)');
    expect(assistant).not.toContain('please try sending your message again.');
  });

  it('does not spend an AI request merely because the panel was opened', async () => {
    const assistant = await readText('src/components/AiAssistant.jsx');
    expect(assistant).toContain('if (greeting) await sendAgentText(conv, greeting);');
    expect(assistant).not.toContain('Hi! What can you help me with on RecordStudio?');
  });

  it('locks guarded messaging to Nali agents and the entitled model tier', async () => {
    const sender = await readText('base44/functions/sendAgentMessage/entry.ts');
    expect(sender).toContain("conversation.agent_name !== 'studio_ai'");
    expect(sender).toContain("conversation.agent_name !== 'studio_ai_plus'");
    expect(sender).toContain("conversation.agent_name === 'studio_ai_plus'");
    expect(sender).toContain("entitlements['ai.best_model']");
    expect(sender).toContain("AI_BEST_MODEL_NOT_ENTITLED");
  });

  it('keeps voice bounded, locale-aware, accessible, and stops it when the panel closes', async () => {
    const assistant = await readText('src/components/AiAssistant.jsx');
    expect(assistant).toContain('const spokenText = clean.slice(0, 4800);');
    expect(assistant).toContain("recognition.lang = navigator.language || 'en-US';");
    expect(assistant).toContain('(!voiceEnabled || !open)');
    expect(assistant).toContain('aria-label={voiceEnabled ? "Mute Nali voice" : "Enable Nali voice"}');
    expect(assistant).toContain('aria-label="Voice input"');
  });

  it('does not proactively summon an assistant the current account cannot use', async () => {
    const onboarding = await readText('src/components/onboarding/OnboardingNaliGuide.jsx');
    const idleHint = await readText('src/components/AskNaliHint.jsx');
    const contextHint = await readText('src/components/nali/NaliContextHint.jsx');
    for (const source of [onboarding, idleHint, contextHint]) {
      expect(source).toContain('hasEntitlement');
      expect(source).toContain('"ai.standard"');
    }
    expect(onboarding).toContain('if (isLoading || !canUseAi || openedRef.current) return;');
    expect(idleHint).toContain('onAuthPage || isLoading || !canUseAi');
    expect(contextHint).toContain('isLoading || !canUseAi || !isProactive');
  });
});
