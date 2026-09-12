import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
    '.next/**',
    'node_modules/**',
    'src-tauri/target/**',
    '.trova-local/**',
    ],
    plugins: { 'react-hooks': reactHooks, react },
    rules: {
      // Existing components use effects for browser-only hydration and local
      // form synchronization. Keep these checks visible without making the
      // repository's baseline lint command fail on legacy code.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
]

export default config
