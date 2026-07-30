// vite.config.ts
import { defineConfig } from "file:///D:/student%20management/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/student%20management/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///D:/student%20management/frontend/node_modules/@tailwindcss/vite/dist/index.mjs";
import { readFileSync } from "node:fs";
var pkgVersion = JSON.parse(readFileSync("./package.json", "utf-8")).version;
var vite_config_default = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion)
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
        // Allow large file uploads through the proxy
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.error("[proxy error]", err.message);
          });
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxzdHVkZW50IG1hbmFnZW1lbnRcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHN0dWRlbnQgbWFuYWdlbWVudFxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovc3R1ZGVudCUyMG1hbmFnZW1lbnQvZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcclxuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJztcclxuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnbm9kZTpmcyc7XHJcblxyXG4vLyBTaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciB0aGUgYXBwIHZlcnNpb246IGZyb250ZW5kL3BhY2thZ2UuanNvbiBcInZlcnNpb25cIi5cclxuLy8gVGhlIHdlYiByZWFkcyBpdCB2aWEgX19BUFBfVkVSU0lPTl9fOyBDSSBzdGFtcHMgdGhlIEFQSydzIHZlcnNpb25OYW1lIHdpdGggaXQuXHJcbmNvbnN0IHBrZ1ZlcnNpb24gPSBKU09OLnBhcnNlKHJlYWRGaWxlU3luYygnLi9wYWNrYWdlLmpzb24nLCAndXRmLTgnKSkudmVyc2lvbiBhcyBzdHJpbmc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIGRlZmluZToge1xyXG4gICAgX19BUFBfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShwa2dWZXJzaW9uKSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCB0YWlsd2luZGNzcygpXSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDUxNzMsXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjQwMDAnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIC8vIEFsbG93IGxhcmdlIGZpbGUgdXBsb2FkcyB0aHJvdWdoIHRoZSBwcm94eVxyXG4gICAgICAgIGNvbmZpZ3VyZTogKHByb3h5KSA9PiB7XHJcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1twcm94eSBlcnJvcl0nLCBlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFvUixTQUFTLG9CQUFvQjtBQUNqVCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFDeEIsU0FBUyxvQkFBb0I7QUFJN0IsSUFBTSxhQUFhLEtBQUssTUFBTSxhQUFhLGtCQUFrQixPQUFPLENBQUMsRUFBRTtBQUV2RSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixRQUFRO0FBQUEsSUFDTixpQkFBaUIsS0FBSyxVQUFVLFVBQVU7QUFBQSxFQUM1QztBQUFBLEVBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUM7QUFBQSxFQUNoQyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUE7QUFBQSxRQUVSLFdBQVcsQ0FBQyxVQUFVO0FBQ3BCLGdCQUFNLEdBQUcsU0FBUyxDQUFDLFFBQVE7QUFDekIsb0JBQVEsTUFBTSxpQkFBaUIsSUFBSSxPQUFPO0FBQUEsVUFDNUMsQ0FBQztBQUFBLFFBQ0g7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
