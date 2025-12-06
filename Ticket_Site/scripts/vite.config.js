import { defineConfig} from 'vite';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
   // configuration options
  define: {
    'process.env': {
      VITE_API_KEY: process.env.VITE_API_KEY,
      VITE_TRANS_URL: process.env.VITE_TRANS_URL,
      VITE_FIRE_KEY: process.env.VITE_FIRE_KEY,
    },
  },
});

