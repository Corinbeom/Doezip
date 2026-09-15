import {CodingPage} from '@/features/coding/coding-page';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <CodingPage id={id}/>;}
