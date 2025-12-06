import { defineConfig,loadEnv } from 'vite';
import dotenv from 'dotenv';
import javascriptObfuscator from 'rollup-plugin-javascript-obfuscator';

dotenv.config();

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: [
        javascriptObfuscator({
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          debugProtection: false,
          debugProtectionInterval: false,
          disableConsoleOutput: true,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          renameGlobals: false,
          rotateStringArray: true,
          selfDefending: true,
          stringArray: true,
          stringArrayEncoding: ['rc4'],
          stringArrayThreshold: 0.75,
          unicodeEscapeSequence: false
        })
      ]
    }
  },
  // configuration options
  define: {
    'process.env': {
      VITE_API_KEY: process.env.VITE_API_KEY,
      VITE_API_URL: process.env.VITE_API_URL,
    },
  },
});

