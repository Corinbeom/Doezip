import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {LandingPage} from './landing-page';

vi.mock('next/navigation',()=>({usePathname:()=>'/'}));

it('explains the product before sending the user into the learning workspace',()=>{
  render(<LandingPage/>);
  expect(screen.getByRole('heading',{level:1,name:/AI의 답을 그대로 쓰지 않고/})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/내 학습 시작하기/})).toHaveAttribute('href','/learn');
  expect(screen.getByRole('heading',{name:'한 번의 과제에서 세 가지를 연습해요.'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'보고서 작성'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'구현 과제'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/공개 과제 먼저 둘러보기/})).toHaveAttribute('href','/tasks');
});
