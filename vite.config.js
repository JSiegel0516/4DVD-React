import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = 'http://localhost:8080';

const backendRootRoutes = [
  '/datasets',
  '/dataset_info',
  '/dataset_dates',
  '/point_statistics',
  '/plot_timeseries',
  '/month_histogram',
  '/plot_histogram',
  '/plot_histogram_month',
  '/plot_month_histogram_across_years',
  '/monthly_mean_std',
  '/monthly_mean_yearly_std',
  '/seasonal_timeseries',
  '/plot_seasonal_timeseries',
  '/plot_monthly_climatology',
  '/statistics',
  '/clear_caches',
];

const backendProxyConfig = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
  },
};

for (const route of backendRootRoutes) {
  backendProxyConfig[route] = {
    target: backendTarget,
    changeOrigin: true,
  };
}

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    proxy: backendProxyConfig,
  },
});
