import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

export default (phase) => ({
  // Keep the dev server's hot-reload artifacts separate from production builds.
  // Sharing .next lets concurrent dev/build processes overwrite webpack chunks,
  // causing errors such as "Cannot find module './887.js'".
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  serverExternalPackages: ['node:sqlite'],
});
