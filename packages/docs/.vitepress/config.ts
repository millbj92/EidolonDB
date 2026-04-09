import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'EidolonDB',
  description: 'Self-managing memory for AI agents',
  base: '/docs/',
  themeConfig: {
    nav: [
      { text: 'eidolondb.com', link: 'https://eidolondb.com' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/overview' },
      { text: 'SDK', link: '/sdk/javascript' },
      { text: 'GitHub', link: 'https://github.com/eidolondb/eidolondb' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Concepts', link: '/guide/concepts' },
          { text: 'Tiers', link: '/guide/tiers' },
          { text: 'Scoring', link: '/guide/scoring' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: '/api/overview' },
          { text: 'Memories', link: '/api/memories' },
          { text: 'Ingest', link: '/api/ingest' },
          { text: 'Lifecycle', link: '/api/lifecycle' },
          { text: 'Relations', link: '/api/relations' },
          { text: 'Events', link: '/api/events' },
          { text: 'Entities', link: '/api/entities' },
          { text: 'Context', link: '/api/context' },
        ],
      },
      {
        text: 'SDK',
        items: [
          { text: 'JavaScript SDK', link: '/sdk/javascript' },
          { text: 'Quickstart', link: '/sdk/quickstart' },
        ],
      },
      {
        text: 'Deploy',
        items: [{ text: 'Self-Hosting', link: '/self-hosting' }],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/eidolondb/eidolondb' }],
  },
});
