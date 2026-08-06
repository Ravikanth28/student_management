import cron from 'node-cron';
import { syncAllGithubStats } from './services/githubService.js';

export function initCronJobs() {
  console.log('[Cron] Initializing scheduled jobs...');
  
  // Run GitHub sync every night at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      await syncAllGithubStats();
    } catch (error) {
      console.error('[Cron] GitHub sync failed:', error);
    }
  });
  
  console.log('[Cron] Nightly GitHub sync scheduled for 00:00.');
}
