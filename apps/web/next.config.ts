import type { NextConfig } from 'next';
// Keep the team's reviewed AGENTS.md stable when starting the dev server.
const config: NextConfig = { agentRules: false };
export default config;
