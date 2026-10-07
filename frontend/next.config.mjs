/** @type {import('next').NextConfig} */
const config = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The development badge overlaps the first tool in the mobile editor.
  devIndicators: false,
};
export default config;
