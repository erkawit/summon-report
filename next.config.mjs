/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['pdfkit', 'exceljs', 'unpdf'],
  outputFileTracingIncludes: {
    '/api/**': ['./templates/**/*'],
  },
};

export default nextConfig;
