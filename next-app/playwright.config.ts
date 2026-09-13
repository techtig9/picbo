import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  timeout:30_000,
  use:{
    baseURL:process.env.E2E_BASE_URL||"http://localhost:3000",
    screenshot:"only-on-failure"
  },
  // Requires `npm run dev` (or a deployed URL via E2E_BASE_URL) plus a real
  // Supabase project with the migrations applied — see e2e/README.md.
  webServer:process.env.E2E_BASE_URL?undefined:{
    command:"npm run dev",
    url:"http://localhost:3000",
    reuseExistingServer:true
  }
});
