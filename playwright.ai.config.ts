import {defineConfig} from '@playwright/test';
import base from './playwright.config';
if(process.env.DOEZIP_LIVE_AI!=='true'||process.env.AI_EVALUATION_ENABLED!=='true'||!process.env.GEMINI_API_KEY?.trim())throw new Error('Use the explicit npm run test:flow:ai command with local AI configuration.');
export default defineConfig(base,{
 testDir:'./tests/live-ai',timeout:240000,retries:0,
 // Avoid recording test JWTs or provider-bound requests in traces.
 use:{...base.use,trace:'off',video:'off',screenshot:'off'},
});
