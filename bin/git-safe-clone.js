#!/usr/bin/env node

import { cloneMain } from '../src/clone.js';

cloneMain().catch((err) => {
  console.error('\nUnexpected error:', err.message || err);
  process.exit(1);
});
