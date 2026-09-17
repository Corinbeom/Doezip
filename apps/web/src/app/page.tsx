import type {Metadata} from 'next';
import {LandingPage} from '@/features/landing/landing-page';

export const metadata:Metadata={
  title:'AI의 답을 내 판단으로 만드는 연습',
  description:'AI와 함께 과제를 해결하고, 근거를 확인하고, 내 판단을 설명하는 훈련 서비스 되짚',
};

export default function Page(){return <LandingPage/>;}
