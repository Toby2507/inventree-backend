import type { UserConfig } from '@commitlint/types';

const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

const BASE_SCOPES = [
  // Bounded Contexts
  'identity',
  'store',
  'catalog',
  'inventory',
  'pos',
  'purchasing',
  'notifications',
  'billing',
  'analytics',
  // Infrastructure
  'database', // migrations, kysely, connection pooling
  'platform', // outbox, audit, eventing, media, mailing, reporting
  'common', // shared kernel — base entities, VOs, domain event base types
  // Tooling
  'ci', // github actions, pipelines, release automation
  'config', // linting, formatting, commitlint, editorconfig
  'deps', // dependency updates
  'security', // security patches and updates
];

const LAYERS = ['domain', 'application', 'infrastructure', 'presentation'];

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', TYPES],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [0], // disabled — validated by custom rule below
    'scope-enum': [0], // disabled — validated by custom rule below
    'scope-empty': [0], // scope optional e.g. `ci: ...`
    'subject-case': [0], // disabled — validated by custom rule below
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'subject-empty': [2, 'never'],
    'body-max-line-length': [2, 'always', 72],
  },
  plugins: [
    {
      rules: {
        'valid-scope': ({ scope }) => {
          if (!scope) return [true];
          const pattern = new RegExp(`^(${BASE_SCOPES.join('|')})(\\/(${LAYERS.join('|')}))?$`);
          return [
            pattern.test(scope),
            `scope must be one of [${BASE_SCOPES.join(', ')}] with optional layer suffix [${LAYERS.join('|')}] e.g. pos/domain`,
          ];
        },
        'no-vague-subject': ({ subject }) => {
          const vague = ['wip', 'fix bug', 'update files', 'add stuff', 'changes', 'misc'];
          const match = vague.some((v) => subject?.toLowerCase().trim() === v);
          return [!match, `subject '${subject}' is too vague — be specific`];
        },
        'subject-first-char-lowercase': ({ subject }) => {
          if (!subject) return [true];
          const firstChar = subject.trim()[0];
          const isLowerCase = firstChar === firstChar.toLowerCase();
          return [isLowerCase, 'first character of subject must be lower-case'];
        },
      },
    },
  ],
};

export default config;
