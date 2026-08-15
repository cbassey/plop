/** @type {import('tailwindcss').Config} */
export default {
  presets: [require('@cbassey/ui-kit/tailwind.preset')],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@cbassey/ui-kit/dist/**/*.js',
  ],
}
