import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {WorkStages} from './work-stages';
it('keeps unsaved work and verification inputs mounted across stage navigation',()=>{
 render(<WorkStages brief={<p>과제 조건</p>} work={<input aria-label="작성 중인 코드" defaultValue=""/>} verification={<input aria-label="미저장 검증"/>} training kind="CODING" busy={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'2. 작업'}));fireEvent.change(screen.getByLabelText('작성 중인 코드'),{target:{value:'unsaved code'}});
 fireEvent.click(screen.getByRole('button',{name:'3. 검증·제출'}));fireEvent.change(screen.getByLabelText('미저장 검증'),{target:{value:'unsaved notes'}});
 fireEvent.click(screen.getByRole('button',{name:'2. 작업'}));expect(screen.getByLabelText('작성 중인 코드')).toHaveValue('unsaved code');
 fireEvent.click(screen.getByRole('button',{name:'3. 검증·제출'}));expect(screen.getByLabelText('미저장 검증')).toHaveValue('unsaved notes');
});
it('does not show training coaching in simulation and disables navigation during submit',()=>{
 render(<WorkStages brief={<p>조건</p>} work={<p>편집</p>} verification={<p>검증</p>} training={false} kind="REPORT" busy/>);
 expect(screen.queryByLabelText('훈련 안내')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'2. 작업'})).toBeDisabled();
});
