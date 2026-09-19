import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {StartSession} from './start-session';
import {createSession} from './api';
import {useAuth} from '@/shared/auth/auth-provider';
const {push}=vi.hoisted(()=>({push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push})}));
vi.mock('./api',()=>({createSession:vi.fn()}));
vi.mock('@/shared/auth/auth-provider',()=>({useAuth:vi.fn()}));
const connected={status:'connected' as const,user:{id:'user',displayName:'학습자',email:null,legalAccepted:true},logout:vi.fn(),reconnect:vi.fn(),acceptPolicies:vi.fn(),deleteAccount:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(useAuth).mockReturnValue(connected);});
it('does not create sessions automatically and prevents double starts while pending',async()=>{
 vi.mocked(createSession).mockImplementation(()=>new Promise(()=>{}));render(<StartSession taskId="task"/>);expect(createSession).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button'));fireEvent.click(screen.getByRole('button'));expect(createSession).toHaveBeenCalledTimes(1);expect(screen.getByRole('button')).toBeDisabled();
});
it('retries an unsuccessful start and navigates only on server success',async()=>{
 vi.mocked(createSession).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({session:{id:'new-session'}} as Awaited<ReturnType<typeof createSession>>);
 render(<StartSession taskId="task"/>);fireEvent.click(screen.getByRole('button'));await screen.findByRole('alert');expect(push).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button'));await waitFor(()=>expect(push).toHaveBeenCalledWith('/sessions/new-session'));
});
it('links anonymous users back to the task after login without creating a session',()=>{
 vi.mocked(useAuth).mockReturnValue({...connected,user:null,status:'anonymous'});render(<StartSession taskId="task"/>);expect(screen.getByRole('link')).toHaveAttribute('href','/login?returnTo=%2Ftasks%2Ftask');expect(createSession).not.toHaveBeenCalled();
});
