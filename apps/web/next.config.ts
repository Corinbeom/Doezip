import type { NextConfig } from 'next';
// Keep the team's reviewed AGENTS.md stable when starting the dev server.
const config: NextConfig = {
  agentRules: false,
  // OAuth callback queries contain one-time codes; exclude them from dev request logs.
  logging: { incomingRequests: { ignore: [/^\/auth\/callback(?:[/?]|$)/] } },
};
export default config;
