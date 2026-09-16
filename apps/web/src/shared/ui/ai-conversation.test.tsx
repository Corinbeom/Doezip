import {render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {MessageContent} from './ai-conversation';

it('renders fenced code as inert text instead of executable HTML',()=>{
 const {container}=render(<MessageContent text={'설명입니다.\n```js\n<script>window.leak=true</script>\n```'}/>);
 expect(screen.getByText('설명입니다.')).toBeVisible();expect(screen.getByText('<script>window.leak=true</script>')).toBeVisible();expect(container.querySelector('script')).toBeNull();expect(container.querySelector('code')).toBeVisible();
});
