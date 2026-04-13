import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const site = process.env.SITE_URL ?? (owner ? `https://${owner}.github.io` : 'https://example.github.io');
const base = process.env.BASE_PATH ?? (repo ? `/${repo}` : '/');

export default defineConfig({
  site,
  base,
  integrations: [
    starlight({
      title: 'Automatic Pro',
      description: 'Simple version pages, downloads, and guides for the Automatic Pro GaggiMate profile family.',
      logo: {
        src: './src/assets/automatic-pro-mark.svg',
        alt: 'Automatic Pro',
      },
      customCss: ['./src/styles/custom.css'],
      components: {
        SocialIcons: './src/components/HeaderLinks.astro',
      },
      social: [
        {
          icon: 'discord',
          label: 'GaggiMate Discord',
          href: 'https://discord.com/invite/3JcR5csD4E',
        },
      ],
      sidebar: [
        { slug: 'index', label: 'Home' },
        {
          label: 'Versions',
          items: [
            { slug: 'v2', label: 'Automatic Pro v2' },
            { slug: 'vit3', label: 'Automatic Pro vIT3' },
            { slug: 'lab', label: 'LAb' },
            { slug: 'pure-flow', label: 'Pure Flow' },
          ],
        },
        { slug: 'downloads', label: 'Downloads' },
        {
          label: 'Guides',
          items: [
            { slug: 'quick-start', label: 'Quick Start / Dialing In' },
            { slug: 'how-automatic-pro-v2-works', label: 'How Automatic Pro v2 Works' },
            { slug: 'troubleshooting', label: 'Troubleshooting' },
            {
              label: 'GM Community Espresso Guide',
              link: 'https://marxd262.github.io/GM_Community_Espresso_Guide/',
              attrs: { target: '_blank', rel: 'noreferrer' },
            },
          ],
        },
      ],
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
    }),
    mdx(),
  ],
});
