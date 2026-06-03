import { sendPhoneOtp } from './src/services/auth';
sendPhoneOtp('0971234567').then(console.log).catch(console.error);
