#!/usr/bin/env node
/** 写入种子数据（幂等）：node scripts/seed.js [--force] */
import { migrate } from '../src/db/index.js'
import { seedDatabase } from '../src/db/seed.js'

const force = process.argv.includes('--force')
migrate()
const result = seedDatabase({ force })
console.log('[seed] 完成:', result)
