import {LearningPage} from '@/features/learning/learning-page';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <LearningPage id={id}/>;}
