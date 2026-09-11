import { WorkspacePage } from '@/features/workspace/workspace-page';
export default async function Page({params}:{params:Promise<{sessionId:string}>}) {
 const {sessionId}=await params;
 return <WorkspacePage sessionId={sessionId}/>;
}
