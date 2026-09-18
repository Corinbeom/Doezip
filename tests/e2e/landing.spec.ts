import {test,expect} from '@playwright/test';

for(const width of [1440,390,320])test(`landing introduces the product without overflow at ${width}px`,async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:width>500?900:844});
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(/AI의 답을 내 판단으로 만드는 연습/);
  await expect(page.getByRole('heading',{level:1,name:/AI의 답을 그대로 쓰지 않고/})).toBeVisible();
  await expect(page.getByRole('link',{name:'과제 둘러보기',exact:true}).first()).toHaveAttribute('href','/tasks');
  await expect(page.getByRole('heading',{name:'보고서 작성',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'구현 과제',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
