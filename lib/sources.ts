// Documentation sources registry
export interface DocSource {
  id: string;
  name: string;
  url: string;
  category: string;
  color: string;
  icon: string;
  description: string;
  searchUrl?: string;
  mobileCssOverride?: string;
}

export const DOC_SOURCES: DocSource[] = [
  {
    id: 'mdn',
    name: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/docs/Web',
    category: 'Web Core',
    color: '#1d4ed8',
    icon: '🌐',
    description: 'HTML, CSS, JavaScript reference',
    searchUrl: 'https://developer.mozilla.org/en-US/search?q={query}',
  },
  {
    id: 'w3schools',
    name: 'W3Schools',
    url: 'https://www.w3schools.com/',
    category: 'Web Core',
    color: '#16a34a',
    icon: '🏫',
    description: 'Web development tutorials & reference',
    searchUrl: 'https://www.w3schools.com/search/search_result.asp?search={query}',
    mobileCssOverride:
      '#main { margin-left: 0 !important; padding: 8px !important; } .sidenav, .w3-sidebar, #mySidenav { display: none !important; } .w3-main { margin-left: 0 !important; }',
  },
  {
    id: 'csstricks',
    name: 'CSS-Tricks',
    url: 'https://css-tricks.com/almanac/',
    category: 'Web Core',
    color: '#2563eb',
    icon: '🎨',
    description: 'CSS tips, tricks & techniques',
    searchUrl: 'https://css-tricks.com/?s={query}',
  },
  {
    id: 'nextjs',
    name: 'Next.js Docs',
    url: 'https://nextjs.org/docs',
    category: 'Framework',
    color: '#6366f1',
    icon: '▲',
    description: 'React framework for production',
  },
  {
    id: 'react',
    name: 'React Docs',
    url: 'https://react.dev/learn',
    category: 'Framework',
    color: '#0ea5e9',
    icon: '⚛️',
    description: 'Official React documentation',
    searchUrl: 'https://react.dev/search?q={query}',
  },
  {
    id: 'vuejs',
    name: 'Vue.js Docs',
    url: 'https://vuejs.org/guide/introduction.html',
    category: 'Framework',
    color: '#4ade80',
    icon: '💚',
    description: 'Progressive JavaScript framework',
  },
  {
    id: 'svelte',
    name: 'Svelte Docs',
    url: 'https://svelte.dev/docs',
    category: 'Framework',
    color: '#f97316',
    icon: '🔥',
    description: 'Cybernetically enhanced web apps',
  },
  {
    id: 'astro',
    name: 'Astro Docs',
    url: 'https://docs.astro.build',
    category: 'Framework',
    color: '#8b5cf6',
    icon: '🚀',
    description: 'Build faster websites',
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com/docs',
    category: 'CSS',
    color: '#38bdf8',
    icon: '💨',
    description: 'Utility-first CSS framework',
  },
  {
    id: 'bootstrap',
    name: 'Bootstrap',
    url: 'https://getbootstrap.com/docs/',
    category: 'CSS',
    color: '#7c3aed',
    icon: '🅱️',
    description: 'Popular CSS framework',
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    url: 'https://www.typescriptlang.org/docs/',
    category: 'Language',
    color: '#3b82f6',
    icon: '🔷',
    description: 'TypeScript handbook & reference',
    searchUrl: 'https://www.typescriptlang.org/search#q={query}',
  },
  {
    id: 'nodejs',
    name: 'Node.js Docs',
    url: 'https://nodejs.org/en/docs/',
    category: 'Language',
    color: '#84cc16',
    icon: '🟢',
    description: 'Node.js API reference',
  },
  {
    id: 'python',
    name: 'Python Docs',
    url: 'https://docs.python.org/3/',
    category: 'Language',
    color: '#facc15',
    icon: '🐍',
    description: 'Python 3 language reference',
    searchUrl: 'https://docs.python.org/3/search.html?q={query}',
  },
  {
    id: 'rust',
    name: 'Rust Docs',
    url: 'https://doc.rust-lang.org/book/',
    category: 'Language',
    color: '#f97316',
    icon: '🦀',
    description: 'The Rust Programming Language',
    searchUrl: 'https://doc.rust-lang.org/std/?search={query}',
  },
  {
    id: 'golang',
    name: 'Go Docs',
    url: 'https://go.dev/doc/',
    category: 'Language',
    color: '#06b6d4',
    icon: '🐹',
    description: 'Go programming language',
    searchUrl: 'https://pkg.go.dev/search?q={query}',
  },
  {
    id: 'django',
    name: 'Django Docs',
    url: 'https://docs.djangoproject.com/en/stable/',
    category: 'Backend',
    color: '#16a34a',
    icon: '🎸',
    description: 'The web framework for perfectionists',
    searchUrl: 'https://docs.djangoproject.com/search/?q={query}',
  },
  {
    id: 'fastapi',
    name: 'FastAPI',
    url: 'https://fastapi.tiangolo.com/',
    category: 'Backend',
    color: '#059669',
    icon: '⚡',
    description: 'Modern, fast web APIs with Python',
  },
  {
    id: 'express',
    name: 'Express.js',
    url: 'https://expressjs.com/en/4x/api.html',
    category: 'Backend',
    color: '#94a3b8',
    icon: '🚂',
    description: 'Node.js web framework',
  },
  {
    id: 'reactnative',
    name: 'React Native',
    url: 'https://reactnative.dev/docs/getting-started',
    category: 'Mobile',
    color: '#0ea5e9',
    icon: '📱',
    description: 'Build native apps with React',
    searchUrl: 'https://reactnative.dev/search?q={query}',
  },
  {
    id: 'expo',
    name: 'Expo Docs',
    url: 'https://docs.expo.dev/',
    category: 'Mobile',
    color: '#5b5fc7',
    icon: '🔵',
    description: 'Expo SDK & EAS documentation',
    searchUrl: 'https://docs.expo.dev/search?q={query}',
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    url: 'https://www.postgresql.org/docs/current/',
    category: 'Database',
    color: '#3b82f6',
    icon: '🐘',
    description: 'PostgreSQL reference manual',
    searchUrl: 'https://www.postgresql.org/search/?q={query}',
  },
  {
    id: 'prisma',
    name: 'Prisma Docs',
    url: 'https://www.prisma.io/docs',
    category: 'Database',
    color: '#2dd4bf',
    icon: '🔺',
    description: 'Next-generation ORM for Node.js',
  },
  {
    id: 'docker',
    name: 'Docker Docs',
    url: 'https://docs.docker.com/',
    category: 'DevOps',
    color: '#0ea5e9',
    icon: '🐳',
    description: 'Docker reference & guides',
    searchUrl: 'https://docs.docker.com/search/?q={query}',
  },
  {
    id: 'git',
    name: 'Git Reference',
    url: 'https://git-scm.com/docs',
    category: 'DevOps',
    color: '#f97316',
    icon: '🌿',
    description: 'Git commands reference',
  },
  {
    id: 'devdocs',
    name: 'DevDocs.io',
    url: 'https://devdocs.io/',
    category: 'Aggregator',
    color: '#6366f1',
    icon: '📚',
    description: '100+ docs in one searchable place',
  },
  {
    id: 'caniuse',
    name: 'Can I Use',
    url: 'https://caniuse.com/',
    category: 'Web Core',
    color: '#ec4899',
    icon: '✅',
    description: 'Browser support compatibility tables',
  },
  {
    id: 'graphql',
    name: 'GraphQL Docs',
    url: 'https://graphql.org/learn/',
    category: 'Backend',
    color: '#e10098',
    icon: '◈',
    description: 'GraphQL query language',
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes Docs',
    url: 'https://kubernetes.io/docs/home/',
    category: 'DevOps',
    color: '#3b82f6',
    icon: '☸️',
    description: 'Container orchestration platform',
    searchUrl: 'https://kubernetes.io/search/?q={query}',
  },
];

export const CATEGORIES = [...new Set(DOC_SOURCES.map((s) => s.category))];

export function getSourceById(id: string): DocSource | undefined {
  return DOC_SOURCES.find((s) => s.id === id);
}

export function getSourcesByCategory(cat: string): DocSource[] {
  return DOC_SOURCES.filter((s) => s.category === cat);
}

export function searchSources(query: string): DocSource[] {
  const q = query.toLowerCase();
  return DOC_SOURCES.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q),
  );
}
