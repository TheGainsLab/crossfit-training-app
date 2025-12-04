/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        coral: '#FE5858',
        charcoal: '#282B34',
        'ice-blue': '#F8FBFE',
        'slate-blue': '#DAE2EA'
      }
    },
  },
  plugins: [],
}

