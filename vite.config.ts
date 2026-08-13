import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Базовый путь для GitHub Pages задаётся через переменную окружения VITE_BASE_PATH
// (например "/derm-treatment-app/"), локально по умолчанию "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
})
