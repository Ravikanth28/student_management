import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.college.studentportal',
  appName: 'Student Management Portal',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // Load the LIVE deployed site inside the app. This means every future UI
    // and backend update reflects automatically in installed apps — no rebuild
    // or reinstall needed for content changes. Override at build time with
    // CAP_SERVER_URL if the deployment URL changes.
    url: process.env.CAP_SERVER_URL ?? 'https://student-portal-7udb.onrender.com',
    cleartext: false,
  },
};

export default config;
