/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compile the whole app to static HTML/JS in ./out so it can be served
  // by any plain web server — here, Laravel's public/ folder.
  output: "export",
  // Static export can't use the default (server) image optimizer.
  images: { unoptimized: true },
  // Emit /login -> /login/index.html so deep links resolve as static files.
  trailingSlash: true,
};

export default nextConfig;
