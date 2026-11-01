import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The production build is one HTML file so it can be copied to another
// computer and opened in a browser, with no install and no dev server.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
