import { pool } from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import https from 'https';

const GITHUB_API_URL = 'https://api.github.com';
const USER_AGENT = 'StudentManagementSystem/1.0';

async function fetchFromGithub(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': USER_AGENT,
        // Add Authorization header if process.env.GITHUB_TOKEN exists
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
      }
    };
    
    https.get(`${GITHUB_API_URL}${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`GitHub API Error: ${res.statusCode} ${data}`));
        }
      });
    }).on('error', reject);
  });
}

export async function fetchGithubStatsForUser(username: string): Promise<{ totalRepos: number; totalCommits: number; lastActive: string | null }> {
  try {
    // Fetch user profile for repo count
    const profile = await fetchFromGithub(`/users/${username}`);
    const totalRepos = profile.public_repos || 0;

    // Fetch public events for commit count and last active
    // Note: GitHub events API only returns the last 90 days / 300 events.
    const events = await fetchFromGithub(`/users/${username}/events/public?per_page=100`);
    
    let totalCommits = 0;
    let lastActive: string | null = null;
    
    if (Array.isArray(events) && events.length > 0) {
      lastActive = events[0].created_at; // Most recent event
      
      for (const event of events) {
        if (event.type === 'PushEvent' && event.payload && event.payload.commits) {
          totalCommits += event.payload.commits.length;
        }
      }
    }
    
    return { totalRepos, totalCommits, lastActive };
  } catch (error) {
    console.error(`Failed to fetch stats for ${username}:`, error);
    return { totalRepos: 0, totalCommits: 0, lastActive: null };
  }
}

export async function getFullGithubProfile(username: string) {
  try {
    const [profile, repos, events] = await Promise.all([
      fetchFromGithub(`/users/${username}`).catch(() => null),
      fetchFromGithub(`/users/${username}/repos?sort=pushed&direction=desc&per_page=10`).catch(() => []),
      fetchFromGithub(`/users/${username}/events/public?per_page=30`).catch(() => [])
    ]);

    return { profile, repos, events };
  } catch (error) {
    console.error(`Failed to fetch full profile for ${username}:`, error);
    throw new Error('Failed to fetch full GitHub profile');
  }
}

export async function syncAllGithubStats(): Promise<void> {
  console.log('[GitHub Sync] Starting nightly sync...');
  const [students] = await pool.query<RowDataPacket[]>('SELECT student_id, github_username FROM github_stats');
  
  let successCount = 0;
  
  for (const student of students) {
    const { student_id, github_username } = student;
    if (!github_username) continue;
    
    console.log(`[GitHub Sync] Fetching stats for ${github_username}...`);
    const { totalRepos, totalCommits, lastActive } = await fetchGithubStatsForUser(github_username);
    
    // Format timestamp for MySQL
    const lastActiveFormatted = lastActive ? new Date(lastActive).toISOString().slice(0, 19).replace('T', ' ') : null;
    
    await pool.query<ResultSetHeader>(
      `UPDATE github_stats 
       SET total_repos = ?, total_commits = ?, last_active = ? 
       WHERE student_id = ?`,
      [totalRepos, totalCommits, lastActiveFormatted, student_id]
    );
    
    successCount++;
    
    // Polite delay of 1 second between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`[GitHub Sync] Completed sync for ${successCount} students.`);
}
