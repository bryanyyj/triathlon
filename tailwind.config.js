/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "tri-bg": "#0b0b14",
        "tri-card": "#14141f",
        "tri-soft": "#1c1c2a",
        "tri-purple": "#7c5cff",
        "tri-pink": "#ff5ca8",
        "tri-blue": "#3ab7ff",
        "tri-green": "#3adf9b",
        "tri-orange": "#ff9f43",
      },
    },
  },
  plugins: [],
};
