/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'charcoal': '#282B34',
        'ice-blue': '#F8FBFE', 
        'slate-blue': '#DAE2EA',
        'coral': '#FE5858'
      }
    },
  },
  plugins: [],
}
